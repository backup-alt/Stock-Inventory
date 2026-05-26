import { developmentApi } from './development-api';

export const environment = {
  production: false,
  apiBaseUrl: developmentApi.baseUrl,
  summaryReportsUrl: developmentApi.summaryReportsUrl,
  stockReportsUrl: developmentApi.stockReportsUrl,
  apiKey: developmentApi.key
};
