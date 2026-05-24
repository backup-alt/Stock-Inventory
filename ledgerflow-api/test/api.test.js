import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';

let server;
let baseUrl;
const apiKey = 'test-key';

before(async () => {
  server = createApp({ clientApiKey: apiKey });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://${address.address}:${address.port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
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
