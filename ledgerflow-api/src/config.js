import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  appName: 'LedgerFlow',
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 8080),
  dataDir: process.env.LEDGERFLOW_DATA_DIR || resolve(rootDir, 'data'),
  maxBodyBytes: Number(process.env.MAX_BODY_BYTES || 1_000_000),
};
