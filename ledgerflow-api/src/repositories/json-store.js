import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export class JsonStore {
  constructor(settings) {
    this.dataDir = settings.dataDir;
    this.upstream = settings.upstream;
    this.cache = new Map();
  }

  source(fileName) {
    if (fileName === 'getSummaryReports.json') {
      return this.report('summary', this.upstream.summaryReportsUrl, [fileName]);
    }

    if (fileName === 'getStockReports.json') {
      return this.report('stock', this.upstream.stockReportsUrl, [fileName]);
    }

    return this.read(['source', fileName]);
  }

  async report(cacheKey, upstreamUrl, localParts) {
    if (upstreamUrl) {
      return this.fetchReport(cacheKey, upstreamUrl);
    }

    return this.read(localParts);
  }

  async fetchReport(cacheKey, url) {
    const headers = {};

    if (this.upstream.apiKey) {
      headers[this.upstream.apiKeyHeader] = this.upstream.apiKeyPrefix
        ? `${this.upstream.apiKeyPrefix} ${this.upstream.apiKey}`
        : this.upstream.apiKey;
    }

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(this.upstream.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Report API ${cacheKey} returned ${response.status}`);
    }

    return response.json();
  }

  async read(parts) {
    const filePath = resolve(this.dataDir, ...parts);
    const cached = this.cache.get(filePath);

    if (cached) {
      return structuredClone(cached);
    }

    const value = JSON.parse(await readFile(filePath, 'utf8'));
    this.cache.set(filePath, value);
    return structuredClone(value);
  }
}
