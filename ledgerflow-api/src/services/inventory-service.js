import { randomUUID } from 'node:crypto';
import { HttpError } from '../http/http-error.js';
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
  constructor(store) {
    this.store = store;
    this.updates = [];
  }

  async summary() {
    const source = await this.stockSource();
    const categories = source.data.inventory.map((category) => {
      const products = category.products || [];
      const totalQuantity = products.reduce((sum, item) => sum + numberOrZero(item.qty), 0);

      return {
        name: cleanText(category.productName),
        productCount: products.length,
        totalQuantity,
        unit: shortUnit(products[0]?.unitName || ''),
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

  async category(slug) {
    if (slug === 'packaging') {
      return this.packaging('all');
    }

    if (slug === 'packaging-rolls') {
      return this.tableFromRows('packaging-rolls', await this.productRows('Roll'));
    }

    if (slug === 'packaging-bags') {
      return this.tableFromRows('packaging-bags', await this.productRows('Bag (unpacked)'));
    }

    if (slug === 'bundles') {
      return this.tableFromRows(slug, await this.productRows('Bundle (unpacked)'));
    }

    if (slug === 'consumables') {
      return this.tableFromRows(slug, await this.productRows('Consumables'));
    }

    if (slug === 'raw-salt') {
      const source = await this.stockSource();
      const raw = rawSaltStock(source);

      return this.tableFromRows(slug, [{
        productGroup: raw.productGroup,
        quantity: raw.qty,
        unit: raw.unitName,
      }]);
    }

    if (slug === 'crystalline') {
      const rows = await this.crystallineRows();
      return this.tableFromRows(slug, rows);
    }

    throw new HttpError(404, 'Inventory category not found');
  }

  async packaging(mode = 'all') {
    const [rolls, bags] = await Promise.all([
      this.productRows('Roll'),
      this.productRows('Bag (unpacked)'),
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
    const quantity = Number(payload.quantity);

    if (!payload.category || !payload.productGroup) {
      throw new HttpError(400, 'Category and productGroup are required');
    }

    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new HttpError(400, 'Quantity must be a non-negative number');
    }

    const update = {
      id: randomUUID(),
      category: cleanText(payload.category),
      productGroup: cleanText(payload.productGroup),
      quantity,
      status: payload.status || stockStatus(quantity),
      note: cleanText(payload.note || ''),
      createdAt: new Date().toISOString(),
    };

    this.updates.unshift(update);

    return {
      success: true,
      data: update,
    };
  }

  async stockSource() {
    return this.store.source('getStockReports.json');
  }

  async productRows(productName) {
    const source = await this.stockSource();
    const category = source.data.inventory.find((item) => cleanText(item.productName) === productName);

    return (category?.products || []).map((product) => ({
      productGroup: product.productGroup,
      quantity: product.qty,
      unit: product.unitName,
    }));
  }

  async crystallineRows() {
    const source = await this.stockSource();
    return (source.data.finishedGoods || []).flatMap((plant) => {
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
}
