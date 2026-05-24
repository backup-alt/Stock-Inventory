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

function fetchApi(path) {
  return fetch(`${baseUrl}${path}`, {
    headers: { 'x-ledgerflow-api-key': apiKey },
  });
}
