import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';

let server;
let baseUrl;
let tempDir;
let updatesFile;
const apiKey = 'test-key';

before(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'ledgerflow-api-'));
  updatesFile = join(tempDir, 'inventory-updates.json');
  server = createApp({ clientApiKey: apiKey, updatesFile });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://${address.address}:${address.port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(tempDir, { recursive: true, force: true });
});

test('health endpoint returns the service status', async () => {
  const response = await fetch(`${baseUrl}/health`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.status, 'ok');
});

test('packaging roll and bag inventory are separate categories', async () => {
  const [rollsResponse, bagsResponse] = await Promise.all([
    fetchApi('/api/inventory/packaging-rolls'),
    fetchApi('/api/inventory/packaging-bags'),
  ]);

  const rolls = await rollsResponse.json();
  const bags = await bagsResponse.json();

  assert.equal(rolls.title, 'Packaging Rolls Inventory');
  assert.equal(bags.title, 'Packaging Bags Inventory');
  assert.notDeepEqual(rolls.items, bags.items);
});

test('dashboard explains raw stock weight without compact units', async () => {
  const response = await fetchApi('/api/dashboard');
  const payload = await response.json();
  const [stockWeight] = payload.kpis;

  assert.equal(response.status, 200);
  assert.equal(stockWeight.label, 'Total Stock Weight');
  assert.equal(stockWeight.value, '300,000');
  assert.equal(stockWeight.unit, 'kg');
  assert.equal(stockWeight.footer, '300 metric tons raw stock');
});

test('inventory updates are accepted and reflected in category responses', async () => {
  const updateResponse = await fetchApi('/api/inventory/updates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: 'Packaging - Rolls',
      productGroup: 'STILT 1 KG FF',
      quantity: 55,
      note: 'Owner correction',
    }),
  });
  const update = await updateResponse.json();
  const rollsResponse = await fetchApi('/api/inventory/packaging-rolls');
  const rolls = await rollsResponse.json();
  const updatedItem = rolls.items.find((item) => item.productGroup === 'STILT 1 KG FF');

  assert.equal(updateResponse.status, 200);
  assert.equal(update.success, true);
  assert.equal(updatedItem.quantity, 55);
  assert.equal(updatedItem.status, 'low-stock');
});

test('custom inventory update entries are appended to category responses', async () => {
  const productGroup = 'Owner Test Bundle';
  const updateResponse = await fetchApi('/api/inventory/updates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: 'Bundle (unpacked)',
      productGroup,
      quantity: 12,
      unit: 'Piece',
      note: 'Custom owner entry',
    }),
  });
  const bundlesResponse = await fetchApi('/api/inventory/bundles');
  const bundles = await bundlesResponse.json();
  const customItem = bundles.items.find((item) => item.productGroup === productGroup);

  assert.equal(updateResponse.status, 200);
  assert.equal(customItem.quantity, 12);
  assert.equal(customItem.unit, 'Piece');
  assert.equal(customItem.status, 'low-stock');
});

test('inventory updates are persisted to json and loaded by a new server', async () => {
  const productGroup = 'Persisted Owner Bundle';
  const updateResponse = await fetchApi('/api/inventory/updates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: 'Bundle (unpacked)',
      productGroup,
      quantity: 24,
      unit: 'Piece',
      note: 'Persistence check',
    }),
  });
  const savedUpdates = JSON.parse(await readFile(updatesFile, 'utf8'));
  const secondServer = createApp({ clientApiKey: apiKey, updatesFile });

  await new Promise((resolve) => secondServer.listen(0, '127.0.0.1', resolve));
  const address = secondServer.address();
  const secondBaseUrl = `http://${address.address}:${address.port}`;
  const bundlesResponse = await fetch(`${secondBaseUrl}/api/inventory/bundles`, {
    headers: { 'x-ledgerflow-api-key': apiKey },
  });
  const bundles = await bundlesResponse.json();
  const customItem = bundles.items.find((item) => item.productGroup === productGroup);
  await new Promise((resolve) => secondServer.close(resolve));

  assert.equal(updateResponse.status, 200);
  assert.equal(savedUpdates[0].productGroup, productGroup);
  assert.equal(customItem.quantity, 24);
});

test('product info recent entries include owner inventory updates', async () => {
  const productGroup = 'Recent Owner Consumable';
  await fetchApi('/api/inventory/updates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: 'Consumables',
      productGroup,
      quantity: 18,
      unit: 'kg',
      note: 'Visible recent card',
    }),
  });
  const response = await fetchApi('/api/products/info');
  const payload = await response.json();
  const [entry] = payload.recentEntries;

  assert.equal(response.status, 200);
  assert.equal(payload.recentEntries.length, 4);
  assert.equal(entry.category, 'Consumables');
  assert.equal(entry.productName, productGroup);
  assert.equal(entry.quantity, '18 kg');
  assert.equal(entry.note, 'Visible recent card');
});

test('inventory detail filters use saved update timestamps', async () => {
  const productGroup = 'Timestamp Filter Bundle';
  await fetchApi('/api/inventory/updates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: 'Bundle (unpacked)',
      productGroup,
      quantity: 44,
      unit: 'Piece',
      note: 'Timestamp filter check',
    }),
  });

  const today = new Date().toISOString().slice(0, 10);
  const [todayResponse, oldResponse] = await Promise.all([
    fetchApi(`/api/inventory/bundles?period=daily&date=${today}`),
    fetchApi('/api/inventory/bundles?period=daily&date=2001-01-01'),
  ]);
  const todayPayload = await todayResponse.json();
  const oldPayload = await oldResponse.json();

  assert.equal(todayResponse.status, 200);
  assert.equal(oldResponse.status, 200);
  assert.ok(todayPayload.items.some((item) => item.productGroup === productGroup));
  assert.ok(!oldPayload.items.some((item) => item.productGroup === productGroup));
});

test('future report dates are rejected', async () => {
  const response = await fetchApi('/api/reports/overall?period=daily&date=2999-01-01');
  const payload = await response.json();

  assert.equal(response.status, 422);
  assert.equal(payload.success, false);
});

test('api endpoints require the generated key', async () => {
  const response = await fetch(`${baseUrl}/api/dashboard`);
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.success, false);
});

function fetchApi(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), 'x-ledgerflow-api-key': apiKey },
  });
}
