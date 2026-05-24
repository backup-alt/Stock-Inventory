import { productionApi } from './production-api';

export const environment = {
  production: true,
  apiBaseUrl: productionApi.baseUrl,
  apiKey: productionApi.key
};
