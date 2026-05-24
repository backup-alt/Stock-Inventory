import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export class JsonStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.cache = new Map();
  }

  ui(fileName) {
    return this.read(['ui', fileName]);
  }

  source(fileName) {
    return this.read(['source', fileName]);
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
