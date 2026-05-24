import { developmentApi } from './development-api';

export const environment = {
  production: false,
  apiBaseUrl: developmentApi.baseUrl,
  apiKey: developmentApi.key
};
