import { dataForPeriod, labelsForPeriod, parseReportFilter, scaleForPeriod } from '../domain/periods.js';
import { statusColor, stockStatus } from '../domain/status.js';
import { cleanText, numberOrZero } from '../domain/strings.js';

export class ReportService {
  constructor(store, inventoryService) {
    this.store = store;
    this.inventoryService = inventoryService;
  }

  async dashboard() {
    const dashboard = await this.store.ui('dashboard.json');
    const inventory = await this.inventoryService.summary();
    const categories = inventory.data.categories;
    const totalQuantity = categories.reduce((sum, category) => sum + numberOrZero(category.totalQuantity), 0);
    const lowStock = await this.lowStockItems();

    return {
      ...dashboard,
      kpis: dashboard.kpis.map((kpi) => {
        if (kpi.label.startsWith('Total Stock')) {
          return { ...kpi, value: compactNumber(totalQuantity) };
        }

        return kpi;
      }),
      criticalStock: lowStock.slice(0, 4),
    };
  }

  async overall(query) {
    const filter = parseReportFilter(query);
    const report = await this.store.ui('overall-report.json');
    const chart = report.analytics.bundlesPacked;

    return {
      ...report,
      filter,
      kpis: report.kpis.map((kpi) => ({
        ...kpi,
        value: scaleForPeriod(kpi.value, filter.period),
      })),
      analytics: {
        bundlesPacked: {
          ...chart,
          label: `Bundles Packed (${filter.period})`,
          labels: labelsForPeriod(filter.period),
          data: dataForPeriod(chart.data, filter.period),
        },
      },
    };
  }

  async stock(query) {
    const filter = parseReportFilter(query);
    const source = await this.inventoryService.stockSource();
    const raw = source.data.rawSaltStock;
    const inventory = source.data.inventory || [];
    const bundles = inventory.find((item) => cleanText(item.productName) === 'Bundle (unpacked)');
    const bags = inventory.find((item) => cleanText(item.productName) === 'Bag (unpacked)');

    return {
      title: 'Stock Report',
      filter,
      cards: [
        stockCard('Raw Stock', raw.qty, raw.unitName),
        stockCard('Finished Goods', totalProductQuantity(bundles), 'Bundles'),
        stockCard('Packaging Bags', totalProductQuantity(bags), 'Total Bags'),
      ],
    };
  }

  async productInfo() {
    return this.store.ui('product-info.json');
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

  async lowStockItems() {
    const source = await this.inventoryService.stockSource();

    return (source.data.inventory || [])
      .flatMap((category) => {
        return (category.products || []).map((product) => {
          const quantity = numberOrZero(product.qty);

          return {
            name: cleanText(product.productGroup),
            quantity,
            unit: cleanText(product.unitName),
            type: stockStatus(quantity),
          };
        });
      })
      .filter((item) => item.type !== 'in-stock')
      .sort((left, right) => left.quantity - right.quantity);
  }
}

function stockCard(title, value, unit) {
  const status = stockStatus(value);
  const color = statusColor(status);

  return {
    title,
    value: Number(value).toLocaleString('en-US'),
    unit,
    status: color,
    trend: {
      direction: color === 'red' ? 'down' : 'up',
      text: color === 'red' ? 'Needs attention' : 'Current snapshot',
    },
  };
}

function totalProductQuantity(category) {
  return (category?.products || []).reduce((sum, item) => sum + numberOrZero(item.qty), 0);
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
