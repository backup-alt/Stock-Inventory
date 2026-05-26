import { productionApi } from './production-api';

export const environment = {
  production: true,
  apiBaseUrl: productionApi.baseUrl,
  summaryReportsUrl: productionApi.summaryReportsUrl,
  stockReportsUrl: productionApi.stockReportsUrl,
  apiKey: productionApi.key
};
