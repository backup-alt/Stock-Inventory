import { createServer } from 'node:http';
import { config } from './config.js';
import { readJsonBody } from './http/request-body.js';
import { Router } from './http/router.js';
import { JsonStore } from './repositories/json-store.js';
import { InventoryService } from './services/inventory-service.js';
import { ReportService } from './services/report-service.js';

export function createApp(options = {}) {
  const settings = { ...config, ...options };
  const store = new JsonStore(settings);
  const inventoryService = new InventoryService(store, settings);
  const reportService = new ReportService(store, inventoryService);
  const router = new Router({ settings, inventoryService, reportService });

  router.get('/', ({ settings }) => ({
    success: true,
    data: {
      app: settings.appName,
      status: 'running',
      routes: ['/health', '/api/dashboard', '/api/reports/overall', '/api/reports/stock', '/api/products/info', '/api/inventory'],
    },
  }));

  router.get('/health', ({ settings }) => ({
    success: true,
    data: {
      app: settings.appName,
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  }));

  router.get('/api/dashboard', ({ reportService }) => reportService.dashboard());
  router.get('/api/reports/overall', ({ reportService, query }) => reportService.overall(query));
  router.get('/api/reports/stock', ({ reportService, query }) => reportService.stock(query));
  router.get('/api/reports/production-log', ({ reportService }) => reportService.productionLog());
  router.get('/api/reports/recent-entries', ({ reportService, query }) => reportService.recentEntries(query));
  router.get('/api/products/info', ({ reportService }) => reportService.productInfo());
  router.get('/api/inventory', ({ inventoryService, query }) => inventoryService.summary(query));
  router.get('/api/inventory/:category', ({ inventoryService, params, query }) => inventoryService.category(params.category, query));
  router.post('/api/inventory/updates', async ({ request, settings, inventoryService }) => {
    const body = await readJsonBody(request, settings.maxBodyBytes);
    return inventoryService.createUpdate(body);
  });

  return createServer((request, response) => router.handle(request, response));
}
