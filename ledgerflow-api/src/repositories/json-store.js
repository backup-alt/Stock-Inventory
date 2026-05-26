import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { currentReportFilter, dateRangeForFilter } from '../domain/periods.js';

export class JsonStore {
  constructor(settings) {
    this.dataDir = settings.dataDir;
    this.upstream = settings.upstream;
    this.cache = new Map();
  }

  source(fileName, filter = undefined) {
    if (fileName === 'getSummaryReports.json') {
      return this.report('summary', this.upstream.summaryReportsUrl, [fileName], filter);
    }

    if (fileName === 'getStockReports.json') {
      return this.report('stock', this.upstream.stockReportsUrl, [fileName], filter);
    }

    return this.read(['source', fileName]);
  }

  async report(cacheKey, upstreamUrl, localParts, filter = undefined) {
    if (upstreamUrl) {
      return this.fetchReport(cacheKey, upstreamUrl, filter);
    }

    return this.read(localParts);
  }

  async fetchReport(cacheKey, url, filter = undefined) {
    const headers = {};
    const resolvedUrl = this.urlWithDateRange(url, filter);
    const cached = this.cache.get(resolvedUrl);

    if (cached) {
      return structuredClone(cached);
    }

    if (this.upstream.apiKey) {
      headers[this.upstream.apiKeyHeader] = this.upstream.apiKeyPrefix
        ? `${this.upstream.apiKeyPrefix} ${this.upstream.apiKey}`
        : this.upstream.apiKey;
    }

    const response = await fetch(resolvedUrl, {
      headers,
      signal: AbortSignal.timeout(this.upstream.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Report API ${cacheKey} returned ${response.status}`);
    }

    const value = await response.json();
    this.cache.set(resolvedUrl, value);
    return structuredClone(value);
  }

  urlWithDateRange(url, filter = undefined) {
    const reportFilter = filter || currentReportFilter();
    const range = dateRangeForFilter(reportFilter);
    const upstreamUrl = new URL(url);

    upstreamUrl.searchParams.set('fromDate', range.fromDate);
    upstreamUrl.searchParams.set('toDate', range.toDate);

    return upstreamUrl.toString();
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
