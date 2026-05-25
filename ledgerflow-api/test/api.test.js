import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { dateRangeForFilter } from '../src/domain/periods.js';

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

test('report date ranges use India local period boundaries', () => {
  const weekly = dateRangeForFilter({ period: 'weekly', date: '2026-05-27' });
  const monthly = dateRangeForFilter({ period: 'monthly', date: '2026-05-25' });

  assert.equal(weekly.fromDate, '2026-05-24T18:30:00.000Z');
  assert.equal(weekly.toDate, '2026-05-31T18:29:59.000Z');
  assert.equal(monthly.fromDate, '2026-04-30T18:30:00.000Z');
  assert.equal(monthly.toDate, '2026-05-31T18:29:59.000Z');
});

test('upstream report URLs receive selected fromDate and toDate params', async () => {
  const upstreamRequests = [];
  const upstreamServer = createHttpServer((request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    upstreamRequests.push(url);
    const payload = url.pathname.endsWith('/getStockReports') ? stockReportPayload() : summaryReportPayload();

    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(payload));
  });

  await new Promise((resolve) => upstreamServer.listen(0, '127.0.0.1', resolve));
  const upstreamAddress = upstreamServer.address();
  const upstreamBaseUrl = `http://${upstreamAddress.address}:${upstreamAddress.port}`;
  const app = createApp({
    clientApiKey: apiKey,
    updatesFile,
    upstream: {
      summaryReportsUrl: `${upstreamBaseUrl}/reports/getSummaryReports`,
      stockReportsUrl: `${upstreamBaseUrl}/reports/getStockReports`,
      apiKey: '',
      apiKeyHeader: 'Authorization',
      apiKeyPrefix: 'Bearer',
      timeoutMs: 1000,
    },
  });

  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  const appAddress = app.address();
  const appBaseUrl = `http://${appAddress.address}:${appAddress.port}`;

  try {
    await fetch(`${appBaseUrl}/api/dashboard?period=monthly&date=2026-05-25`, {
      headers: { 'x-ledgerflow-api-key': apiKey },
    });
    await fetch(`${appBaseUrl}/api/reports/stock?period=weekly&date=2026-05-25`, {
      headers: { 'x-ledgerflow-api-key': apiKey },
    });
  } finally {
    await new Promise((resolve) => app.close(resolve));
    await new Promise((resolve) => upstreamServer.close(resolve));
  }

  const summaryRequest = upstreamRequests.find((url) => url.pathname.endsWith('/getSummaryReports'));
  const stockRequests = upstreamRequests.filter((url) => url.pathname.endsWith('/getStockReports'));
  const weeklyStockRequest = stockRequests.find((url) => url.searchParams.get('fromDate') === '2026-05-24T18:30:00.000Z');

  assert.equal(summaryRequest.searchParams.get('fromDate'), '2026-04-30T18:30:00.000Z');
  assert.equal(summaryRequest.searchParams.get('toDate'), '2026-05-31T18:29:59.000Z');
  assert.ok(weeklyStockRequest);
  assert.equal(weeklyStockRequest.searchParams.get('toDate'), '2026-05-31T18:29:59.000Z');
});

test('explicit date ranges preserve the selected report period', async () => {
  const response = await fetchApi('/api/reports/overall?period=monthly&date=2026-05-25&fromDate=2026-04-30T18%3A30%3A00.000Z&toDate=2026-05-31T18%3A29%3A59.000Z');
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.filter.period, 'monthly');
  assert.equal(payload.filter.fromDate, '2026-05-01');
  assert.equal(payload.filter.toDate, '2026-05-31');
});

test('custom report date ranges create graph buckets for selected days', async () => {
  const response = await fetchApi('/api/reports/overall?period=weekly&rangeType=custom&date=2026-05-22&fromDate=2026-05-11T18%3A30%3A00.000Z&toDate=2026-05-22T18%3A29%3A59.000Z');
  const payload = await response.json();
  const chart = payload.analytics.bundlesPacked;

  assert.equal(response.status, 200);
  assert.equal(payload.filter.period, 'weekly');
  assert.equal(payload.filter.rangeType, 'custom');
  assert.equal(chart.labels.length, 11);
  assert.equal(chart.data.length, 11);
  assert.equal(chart.labels[0], 'May 12');
  assert.equal(chart.labels[10], 'May 22');
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

test('product info recent entries do not show placeholder stock rows', async () => {
  const response = await fetchApi('/api/products/info');
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.recentEntries, []);
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

test('recent stock entries are filtered to saved owner updates', async () => {
  const productGroup = 'Recent Mobile Entry';
  await fetchApi('/api/inventory/updates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: 'Packaging - Bags',
      productGroup,
      quantity: 33,
      unit: 'Piece',
      note: 'Entered from mobile',
    }),
  });

  const today = new Date().toISOString().slice(0, 10);
  const [todayResponse, oldResponse] = await Promise.all([
    fetchApi(`/api/reports/recent-entries?period=daily&date=${today}`),
    fetchApi('/api/reports/recent-entries?period=daily&date=2001-01-01'),
  ]);
  const todayPayload = await todayResponse.json();
  const oldPayload = await oldResponse.json();
  const entry = todayPayload.items.find((item) => item.productGroup === productGroup);

  assert.equal(todayResponse.status, 200);
  assert.equal(oldResponse.status, 200);
  assert.equal(entry.category, 'Packaging - Bags');
  assert.equal(entry.note, 'Entered from mobile');
  assert.equal(entry.quantity, 33);
  assert.equal(oldPayload.items.length, 0);
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

function summaryReportPayload() {
  return {
    data: {
      reports: {
        orderPlaced: [],
        stockEntry: [],
        production: [],
        inventoryUsed: [],
      },
    },
  };
}

function stockReportPayload() {
  return {
    data: {
      rawSaltStock: {
        productGroup: 'Raw Salt',
        qty: 1,
        unitName: 'Metric Ton',
      },
      inventory: [
        { productName: 'Bundle (unpacked)', products: [] },
        { productName: 'Roll', products: [] },
        { productName: 'Bag (unpacked)', products: [] },
      ],
      finishedGoods: [],
    },
  };
}
