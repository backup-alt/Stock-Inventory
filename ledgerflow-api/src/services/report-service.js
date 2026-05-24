import { dataForPeriod, labelsForPeriod, parseReportFilter } from '../domain/periods.js';
import { statusColor, stockStatus } from '../domain/status.js';
import { cleanText, numberOrZero } from '../domain/strings.js';

export class ReportService {
  constructor(store, inventoryService) {
    this.store = store;
    this.inventoryService = inventoryService;
  }

  async dashboard() {
    const [stock, summary] = await Promise.all([
      this.inventoryService.stockSource(),
      this.summarySource(),
    ]);
    const lowStock = await this.lowStockItems(stock);
    const totals = stockTotals(stock);
    const reports = summary.data.reports || {};

    return {
      greeting: 'Good Morning, Owner',
      subtitle: 'Live warehouse status from the latest API reports.',
      kpis: [
        {
          label: 'Total Stock (kg)',
          value: compactNumber(totals.all),
          icon: 'inventory_2',
          trend: { direction: 'up', percentage: 'Live' },
        },
        {
          label: 'Orders Today',
          value: countRows(reports.orderPlaced),
          icon: 'shopping_cart',
          footer: `${countRows(reports.stockEntry)} stock entries`,
        },
        {
          label: 'Deliveries Out',
          value: countRows(reports.production),
          icon: 'local_shipping',
          footer: 'Production report rows',
        },
        {
          label: 'Pending Entry',
          value: lowStock.length,
          icon: 'input',
          footer: 'Low or zero stock items',
        },
      ],
      criticalStock: lowStock.slice(0, 4),
      normalStock: topStockItems(stock).slice(0, 3),
      inventoryBreakdown: [
        {
          label: 'Raw Salt (MT)',
          value: numberOrZero(stock.data.rawSaltStock?.qty),
          icon: 'landscape',
          color: 'secondary',
          alert: false,
        },
        {
          label: 'Finished (BNDL)',
          value: compactNumber(totals.bundles),
          icon: 'check_box',
          color: 'primary',
          alert: totals.bundles <= 0,
        },
        {
          label: 'Empty Bags',
          value: compactNumber(totals.bags),
          icon: 'shopping_bag',
          color: 'tertiary',
          alert: totals.bags <= 100,
        },
        {
          label: 'Pkg Rolls (KG)',
          value: compactNumber(totals.rolls),
          icon: 'texture',
          color: 'on-surface-variant',
          alert: totals.rolls <= 100,
        },
      ],
    };
  }

  async overall(query) {
    const filter = parseReportFilter(query);
    const summary = await this.summarySource();
    const reports = summary.data.reports || {};
    const production = reports.production || [];
    const inventoryUsed = reports.inventoryUsed || [];
    const stockEntry = reports.stockEntry || [];
    const orderPlaced = reports.orderPlaced || [];
    const productionSeries = bucketQuantities(production, 6);

    return {
      title: 'Overall Report',
      filter,
      kpis: [
        {
          label: 'Bundles Packed',
          value: totalQuantity(production).toLocaleString('en-US'),
          icon: 'inventory_2',
          trend: { direction: 'up', percentage: 'Live' },
          target: { label: `Rows: ${production.length}`, percentage: 83 },
        },
        {
          label: 'Material Consumed',
          value: totalQuantity(inventoryUsed).toLocaleString('en-US'),
          unit: 'units',
          icon: 'receipt_long',
          progress: { label: 'Live report', percentage: inventoryUsed.length ? 65 : 0 },
        },
        {
          label: 'New Stock Entered',
          value: totalQuantity(stockEntry).toLocaleString('en-US'),
          unit: 'units',
          icon: 'input',
          footer: `${stockEntry.length} entries`,
        },
        {
          label: 'Orders Placed',
          value: orderPlaced.length,
          icon: 'local_shipping',
          badge: { text: `${orderPlaced.length} Live`, icon: 'schedule' },
          footer: 'From summary report',
        },
      ],
      analytics: {
        bundlesPacked: {
          label: `Bundles Packed (${filter.period})`,
          data: dataForPeriod(productionSeries, filter.period),
          labels: labelsForPeriod(filter.period),
        },
      },
    };
  }

  async stock(query) {
    const filter = parseReportFilter(query);
    const source = await this.inventoryService.stockSource();
    const totals = stockTotals(source);
    const raw = source.data.rawSaltStock;

    return {
      title: 'Stock Report',
      filter,
      cards: [
        stockCard('Raw Stock', raw?.qty, raw?.unitName || 'Metric Ton'),
        stockCard('Finished Goods', totals.bundles, 'Bundles'),
        stockCard('Packaging Bags', totals.bags, 'Total Bags'),
      ],
    };
  }

  async productInfo() {
    const [stock, summary] = await Promise.all([
      this.inventoryService.stockSource(),
      this.summarySource(),
    ]);
    const reports = summary.data.reports || {};
    const productionTotal = totalQuantity(reports.production || []);

    return {
      hero: {
        title: 'Inventory',
        lotNumber: `Live snapshot - ${countRows(stock.data.inventory)} stock categories`,
        status: 'ACTIVE',
      },
      productionHighlights: {
        avgMonthlyYield: {
          value: Math.round(productionTotal * 100) / 100,
          unit: 'Units',
        },
      },
      recentEntries: recentStockEntries(reports.stockEntry || []),
      inventoryCategories: productCategories(stock),
    };
  }

  async productionLog() {
    const summary = await this.summarySource();
    return this.tableReport('Production Details', 'Report > Production Details', summary.data.reports.production || []);
  }

  async recentEntries() {
    const summary = await this.summarySource();
    return this.tableReport('Recent Stock Entries', 'Report > Recent Stock Entries', summary.data.reports.stockEntry || []);
  }

  async summarySource() {
    return this.store.source('getSummaryReports.json');
  }

  tableReport(title, description, rows) {
    return {
      title,
      description,
      breadcrumb: description.split('>').map((item) => item.trim()),
      items: rows.map((row) => {
        const quantity = numberOrZero(row.quantity);

        return {
          productGroup: cleanText(row.productBrand || row.productGroup || row.productName),
          subLabel: cleanText(row.productBrand ? row.productGroup : row.productName),
          quantity,
          unit: cleanText(row.unit),
          status: stockStatus(quantity),
        };
      }),
    };
  }

  async lowStockItems(source = undefined) {
    const stock = source || await this.inventoryService.stockSource();

    return allInventoryProducts(stock)
      .map((product) => {
        const quantity = numberOrZero(product.qty);

        return {
          name: cleanText(product.productGroup),
          quantity,
          unit: cleanText(product.unitName),
          type: stockStatus(quantity),
        };
      })
      .filter((item) => item.type !== 'in-stock')
      .sort((left, right) => left.quantity - right.quantity);
  }
}

function productCategories(stock) {
  const raw = stock.data.rawSaltStock || {};
  const categories = stock.data.inventory || [];
  const bundles = findCategory(categories, 'Bundle (unpacked)');
  const rolls = findCategory(categories, 'Roll');
  const bags = findCategory(categories, 'Bag (unpacked)');
  const consumables = findCategory(categories, 'Consumables');

  return [
    {
      title: 'Raw Salt Stock',
      items: [productInfoItem(raw.productGroup || 'Raw Salt', raw.qty, raw.unitName || 'Metric Ton')],
    },
    {
      title: 'Bundle (unpacked)',
      items: productInfoItems(bundles?.products || []),
    },
    {
      title: 'Packaging - Rolls',
      items: productInfoItems(rolls?.products || []),
    },
    {
      title: 'Packaging - Bags',
      items: productInfoItems(bags?.products || []),
    },
    {
      title: 'Consumables',
      items: productInfoItems(consumables?.products || []),
    },
  ].filter((category) => category.items.length > 0);
}

function productInfoItems(products) {
  return products.map((product) => productInfoItem(product.productGroup, product.qty, product.unitName));
}

function productInfoItem(name, quantity, unit) {
  const value = numberOrZero(quantity);

  return {
    name: cleanText(name),
    quantity: value,
    unit: cleanText(unit),
    status: uiStatus(stockStatus(value)),
  };
}

function recentStockEntries(rows) {
  return rows.slice(0, 5).map((row, index) => ({
    type: 'inbound',
    label: `Stock entry - ${cleanText(row.productGroup || row.productName || `Entry ${index + 1}`)}`,
    date: 'Live snapshot',
    quantity: `+${numberOrZero(row.quantity).toLocaleString('en-US')} ${cleanText(row.unit)}`,
    source: cleanText(row.plantName || 'API report'),
    icon: 'add_circle',
  }));
}

function stockCard(title, value, unit) {
  const quantity = numberOrZero(value);
  const status = stockStatus(quantity);
  const color = statusColor(status);

  return {
    title,
    value: quantity.toLocaleString('en-US'),
    unit,
    status: color,
    trend: {
      direction: color === 'red' ? 'down' : 'up',
      text: color === 'red' ? 'Needs attention' : 'Live snapshot',
    },
  };
}

function stockTotals(stock) {
  const categories = stock.data.inventory || [];

  return {
    all: allInventoryProducts(stock).reduce((sum, item) => sum + numberOrZero(item.qty), numberOrZero(stock.data.rawSaltStock?.qty)),
    bundles: totalProductQuantity(findCategory(categories, 'Bundle (unpacked)')),
    rolls: totalProductQuantity(findCategory(categories, 'Roll')),
    bags: totalProductQuantity(findCategory(categories, 'Bag (unpacked)')),
  };
}

function topStockItems(stock) {
  return allInventoryProducts(stock)
    .map((product) => ({
      name: cleanText(product.productGroup),
      quantity: numberOrZero(product.qty),
      unit: cleanText(product.unitName),
      status: 'In Stock',
      icon: 'inventory_2',
    }))
    .sort((left, right) => right.quantity - left.quantity);
}

function allInventoryProducts(stock) {
  return (stock.data.inventory || []).flatMap((category) => category.products || []);
}

function findCategory(categories, productName) {
  return categories.find((item) => cleanText(item.productName) === productName);
}

function totalProductQuantity(category) {
  return (category?.products || []).reduce((sum, item) => sum + numberOrZero(item.qty), 0);
}

function totalQuantity(rows) {
  return (rows || []).reduce((sum, row) => sum + numberOrZero(row.quantity), 0);
}

function countRows(rows) {
  return Array.isArray(rows) ? rows.length : 0;
}

function bucketQuantities(rows, bucketCount) {
  const buckets = Array.from({ length: bucketCount }, () => 0);

  rows.forEach((row, index) => {
    buckets[index % bucketCount] += numberOrZero(row.quantity);
  });

  return buckets.map((value) => Math.round(value));
}

function compactNumber(value) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}m`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }

  return String(value);
}

function uiStatus(status) {
  if (status === 'out-of-stock') {
    return 'critical';
  }

  if (status === 'low-stock') {
    return 'low';
  }

  return 'ok';
}
