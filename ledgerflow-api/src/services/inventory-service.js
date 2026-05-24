import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { HttpError } from '../http/http-error.js';
import { parseReportFilter } from '../domain/periods.js';
import { cleanText, numberOrZero, shortUnit, titleFromSlug } from '../domain/strings.js';
import { rawSaltStock } from '../domain/stock-source.js';
import { stockStatus } from '../domain/status.js';

const categoryTitles = {
  bundles: 'Bundle Inventory',
  'raw-salt': 'Raw Salt Inventory',
  packaging: 'Packaging Inventory',
  'packaging-rolls': 'Packaging Rolls Inventory',
  'packaging-bags': 'Packaging Bags Inventory',
  consumables: 'Consumables Inventory',
  crystalline: 'Product Inventory',
};

export class InventoryService {
  constructor(store, settings = {}) {
    this.store = store;
    this.updatesFile = settings.updatesFile;
    this.updates = [];
    this.updatesLoaded = false;
  }

  async summary(query = undefined) {
    await this.ensureUpdatesLoaded();
    const filter = query ? parseReportFilter(query) : null;
    const source = await this.stockSource();
    const categories = source.data.inventory.map((category) => {
      const categorySlug = categorySlugFromProductName(category.productName);
      const products = this.applyUpdates(categorySlug, (category.products || []).map((product) => ({
        productGroup: product.productGroup,
        quantity: product.qty,
        unit: product.unitName,
      })), filter);
      const totalQuantity = products.reduce((sum, item) => sum + numberOrZero(item.quantity), 0);

      return {
        name: cleanText(category.productName),
        productCount: products.length,
        totalQuantity,
        unit: shortUnit(products[0]?.unit || ''),
      };
    });

    return {
      success: true,
      data: {
        rawSaltStock: rawSaltStock(source),
        categories,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  async category(slug, query = undefined) {
    await this.ensureUpdatesLoaded();
    const filter = query ? parseReportFilter(query) : null;

    if (slug === 'packaging') {
      return this.packaging('all', filter);
    }

    if (slug === 'packaging-rolls') {
      return this.tableFromRows('packaging-rolls', await this.productRows('Roll', filter));
    }

    if (slug === 'packaging-bags') {
      return this.tableFromRows('packaging-bags', await this.productRows('Bag (unpacked)', filter));
    }

    if (slug === 'bundles') {
      return this.tableFromRows(slug, await this.productRows('Bundle (unpacked)', filter));
    }

    if (slug === 'consumables') {
      return this.tableFromRows(slug, await this.productRows('Consumables', filter));
    }

    if (slug === 'raw-salt') {
      const source = await this.stockSource();
      const raw = rawSaltStock(source);
      const rows = this.applyUpdates('raw-salt', [{
        productGroup: raw.productGroup,
        quantity: raw.qty,
        unit: raw.unitName,
      }], filter);

      return this.tableFromRows(slug, rows);
    }

    if (slug === 'crystalline') {
      const rows = await this.crystallineRows(filter);
      return this.tableFromRows(slug, rows);
    }

    throw new HttpError(404, 'Inventory category not found');
  }

  async packaging(mode = 'all', filter = null) {
    await this.ensureUpdatesLoaded();
    const [rolls, bags] = await Promise.all([
      this.productRows('Roll', filter),
      this.productRows('Bag (unpacked)', filter),
    ]);

    if (mode === 'rolls') {
      return this.tableFromRows('packaging-rolls', rolls);
    }

    if (mode === 'bags') {
      return this.tableFromRows('packaging-bags', bags);
    }

    return {
      title: categoryTitles.packaging,
      description: 'Current stock levels for roll and bag packaging materials across all zones.',
      breadcrumb: ['Stock', 'Packaging Inventory'],
      rolls: rolls.map((item) => this.inventoryItem(item)),
      bags: bags.map((item) => this.inventoryItem(item)),
    };
  }

  async createUpdate(payload) {
    await this.ensureUpdatesLoaded();
    const quantity = Number(payload.quantity);
    const categorySlug = categorySlugFromLabel(payload.category);

    if (!categorySlug || !payload.productGroup) {
      throw new HttpError(400, 'Category and productGroup are required');
    }

    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new HttpError(400, 'Quantity must be a non-negative number');
    }

    const update = {
      id: randomUUID(),
      category: cleanText(payload.category),
      categorySlug,
      productGroup: cleanText(payload.productGroup),
      quantity,
      unit: shortUnit(payload.unit || defaultUnit(categorySlug)),
      status: stockStatus(quantity),
      note: cleanText(payload.note || ''),
      createdAt: new Date().toISOString(),
    };

    this.updates.unshift(update);
    await this.persistUpdates();

    return {
      success: true,
      data: update,
    };
  }

  async recentUpdates(options = undefined) {
    await this.ensureUpdatesLoaded();
    const limit = typeof options === 'number' ? options : options?.limit;
    const filter = typeof options === 'number' ? null : options?.filter;
    const updates = filter ? this.updates.filter((update) => updateMatchesFilter(update, filter)) : this.updates;

    if (typeof limit === 'number') {
      return updates.slice(0, limit);
    }

    return [...updates];
  }

  async stockSource() {
    return this.store.source('getStockReports.json');
  }

  async productRows(productName, filter = null) {
    await this.ensureUpdatesLoaded();
    const source = await this.stockSource();
    const category = source.data.inventory.find((item) => cleanText(item.productName) === productName);
    const categorySlug = categorySlugFromProductName(productName);
    const rows = (category?.products || []).map((product) => ({
      productGroup: product.productGroup,
      quantity: product.qty,
      unit: product.unitName,
    }));

    return this.applyUpdates(categorySlug, rows, filter);
  }

  async crystallineRows(filter = null) {
    await this.ensureUpdatesLoaded();
    const source = await this.stockSource();
    const rows = (source.data.finishedGoods || []).flatMap((plant) => {
      return (plant.groups || [])
        .filter((group) => cleanText(group.productGroup).toLowerCase().includes('crystal'))
        .flatMap((group) => {
          return (group.products || []).map((product) => ({
            productGroup: product.productBrand,
            subLabel: cleanText(group.productGroup),
            quantity: product.qty,
            unit: product.unitName,
          }));
        });
    });

    return this.applyUpdates('crystalline', rows, filter);
  }

  tableFromRows(slug, rows) {
    return {
      title: categoryTitles[slug] || titleFromSlug(slug),
      description: `${categoryTitles[slug] || titleFromSlug(slug)} from the current inventory snapshot.`,
      breadcrumb: ['Stock', categoryTitles[slug] || titleFromSlug(slug)],
      items: rows.map((item) => this.inventoryItem(item)),
    };
  }

  inventoryItem(item) {
    const quantity = numberOrZero(item.quantity);

    return {
      productGroup: cleanText(item.productGroup),
      subLabel: item.subLabel ? cleanText(item.subLabel) : null,
      quantity,
      unit: shortUnit(item.unit),
      status: stockStatus(quantity),
    };
  }

  applyUpdates(categorySlug, rows, filter = null) {
    if (!categorySlug) {
      return rows;
    }

    const updates = this.filteredUpdates(categorySlug, filter);
    const rowKeys = new Set(rows.map((row) => cleanText(row.productGroup).toLowerCase()));
    const updatedRows = rows.map((row) => {
      const update = this.latestUpdate(updates, row.productGroup);
      return update ? { ...row, quantity: update.quantity, unit: update.unit || row.unit } : row;
    });
    const customRows = this.uniqueUpdates(updates)
      .filter((update) => !rowKeys.has(cleanText(update.productGroup).toLowerCase()))
      .map((update) => ({
        productGroup: update.productGroup,
        quantity: update.quantity,
        unit: update.unit,
      }));

    return [...customRows, ...updatedRows];
  }

  latestUpdate(updates, productGroup) {
    const normalizedProduct = cleanText(productGroup).toLowerCase();
    return updates.find((update) => cleanText(update.productGroup).toLowerCase() === normalizedProduct);
  }

  filteredUpdates(categorySlug, filter) {
    return this.updates.filter((update) => {
      return update.categorySlug === categorySlug && updateMatchesFilter(update, filter);
    });
  }

  uniqueUpdates(updates) {
    const seen = new Set();

    return updates.filter((update) => {
      const key = cleanText(update.productGroup).toLowerCase();
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  async ensureUpdatesLoaded() {
    if (this.updatesLoaded) {
      return;
    }

    this.updatesLoaded = true;

    if (!this.updatesFile) {
      return;
    }

    try {
      const contents = await readFile(this.updatesFile, 'utf8');
      const value = JSON.parse(contents);
      this.updates = Array.isArray(value) ? value : [];
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }

      this.updates = [];
      await this.persistUpdates();
    }
  }

  async persistUpdates() {
    if (!this.updatesFile) {
      return;
    }

    await mkdir(dirname(this.updatesFile), { recursive: true });
    await writeFile(this.updatesFile, `${JSON.stringify(this.updates, null, 2)}\n`);
  }
}

function categorySlugFromProductName(productName) {
  const value = cleanText(productName).toLowerCase();

  if (value === 'bundle (unpacked)') {
    return 'bundles';
  }

  if (value === 'roll') {
    return 'packaging-rolls';
  }

  if (value === 'bag (unpacked)') {
    return 'packaging-bags';
  }

  if (value === 'consumables') {
    return 'consumables';
  }

  return categorySlugFromLabel(productName);
}

function categorySlugFromLabel(label) {
  const value = cleanText(label).toLowerCase();

  if (value.includes('raw')) {
    return 'raw-salt';
  }

  if (value.includes('bundle')) {
    return 'bundles';
  }

  if (value.includes('roll')) {
    return 'packaging-rolls';
  }

  if (value.includes('bag')) {
    return 'packaging-bags';
  }

  if (value.includes('consumable')) {
    return 'consumables';
  }

  if (value.includes('crystalline') || value.includes('crystal')) {
    return 'crystalline';
  }

  return '';
}

function defaultUnit(categorySlug) {
  switch (categorySlug) {
    case 'raw-salt':
      return 'MT';
    case 'packaging-rolls':
    case 'consumables':
      return 'kg';
    case 'bundles':
      return 'Piece';
    case 'packaging-bags':
    case 'crystalline':
      return 'Piece';
    default:
      return 'Unit';
  }
}

function updateMatchesFilter(update, filter) {
  if (!filter) {
    return true;
  }

  if (!update.createdAt) {
    return true;
  }

  const createdAt = new Date(update.createdAt);

  if (Number.isNaN(createdAt.getTime())) {
    return true;
  }

  const { start, end } = rangeForFilter(filter);
  return createdAt >= start && createdAt < end;
}

function rangeForFilter(filter) {
  const selected = dateFromIso(filter.date);

  if (filter.period === 'monthly') {
    const start = new Date(selected.getFullYear(), selected.getMonth(), 1);
    const end = new Date(selected.getFullYear(), selected.getMonth() + 1, 1);
    return { start, end };
  }

  if (filter.period === 'weekly') {
    const start = new Date(selected);
    start.setDate(selected.getDate() - 6);
    const end = new Date(selected);
    end.setDate(selected.getDate() + 1);
    return { start, end };
  }

  const start = new Date(selected);
  const end = new Date(selected);
  end.setDate(selected.getDate() + 1);
  return { start, end };
}

function dateFromIso(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}
