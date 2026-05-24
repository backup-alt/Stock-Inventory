import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  appName: 'LedgerFlow',
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 8080),
  dataDir: process.env.LEDGERFLOW_DATA_DIR || resolve(rootDir, 'data'),
  maxBodyBytes: Number(process.env.MAX_BODY_BYTES || 1_000_000),
  upstream: {
    summaryReportsUrl: process.env.SUMMARY_REPORTS_URL || process.env.GET_SUMMARY_REPORTS_URL || '',
    stockReportsUrl: process.env.STOCK_REPORTS_URL || process.env.GET_STOCK_REPORTS_URL || '',
    apiKey: process.env.REPORTS_API_KEY || process.env.API_KEY || '',
    apiKeyHeader: process.env.REPORTS_API_KEY_HEADER || 'Authorization',
    apiKeyPrefix: process.env.REPORTS_API_KEY_PREFIX || 'Bearer',
    timeoutMs: Number(process.env.REPORTS_TIMEOUT_MS || 10_000),
  },
};
