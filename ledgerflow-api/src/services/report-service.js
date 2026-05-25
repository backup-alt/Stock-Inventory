import { currentReportFilter, dateRangeForFilter, labelsForPeriod, parseReportFilter } from '../domain/periods.js';
import { statusColor, stockStatus } from '../domain/status.js';
import { cleanText, numberOrZero, shortUnit } from '../domain/strings.js';
import { rawSaltStock } from '../domain/stock-source.js';

export class ReportService {
  constructor(store, inventoryService) {
    this.store = store;
    this.inventoryService = inventoryService;
  }

  async dashboard(query) {
    const filter = parseReportFilter(query);
    const [stock, summary] = await Promise.all([
      this.inventoryService.stockSource(filter),
      this.summarySource(filter),
    ]);
    const lowStock = await this.lowStockItems(stock);
    const totals = stockTotals(stock);
    const raw = rawSaltStock(stock);
    const reports = summary.data.reports || {};

    return {
      greeting: 'Good Morning, Owner',
      subtitle: `Warehouse status for the selected ${filter.period.replace('-', ' ')}.`,
      filter,
      kpis: [
        {
          label: 'Total Stock Weight',
          value: totals.rawKg.toLocaleString('en-US'),
          unit: 'kg',
          icon: 'inventory_2',
          footer: `${numberOrZero(raw.qty).toLocaleString('en-US')} metric tons raw stock`,
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
          value: numberOrZero(raw.qty),
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
    const summary = await this.summarySource(filter);
    const reports = summary.data.reports || {};
    const production = reports.production || [];
    const inventoryUsed = reports.inventoryUsed || [];
    const stockEntry = reports.stockEntry || [];
    const orderPlaced = reports.orderPlaced || [];

    return {
      title: 'Overall Report',
      filter,
      kpis: [
        {
          label: 'Bundles Packed',
          value: totalQuantity(production).toLocaleString('en-US'),
          icon: 'inventory_2',
        },
        {
          label: 'Material Consumed',
          value: totalQuantity(inventoryUsed).toLocaleString('en-US'),
          unit: 'units',
          icon: 'receipt_long',
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
        },
      ],
      analytics: {
        bundlesPacked: analyticsForPeriod(production, filter),
      },
    };
  }

  async stock(query) {
    const filter = parseReportFilter(query);
    const source = await this.inventoryService.stockSource(filter);
    const totals = stockTotals(source);
    const raw = rawSaltStock(source);

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
    const filter = currentReportFilter('daily');
    const [stock, summary] = await Promise.all([
      this.inventoryService.stockSource(filter),
      this.summarySource(filter),
    ]);
    const reports = summary.data.reports || {};
    const productionTotal = totalQuantity(reports.production || []);

    return {
      hero: {
        title: 'Inventory',
        lotNumber: `${countRows(stock.data.inventory)} stock categories`,
        status: 'ACTIVE',
      },
      productionHighlights: {
        avgMonthlyYield: {
          value: Math.round(productionTotal * 100) / 100,
          unit: 'Units',
        },
      },
      recentEntries: recentStockEntries(reports.stockEntry || [], 4),
      inventoryCategories: productCategories(stock),
    };
  }

  async productionLog(query) {
    const filter = parseReportFilter(query);
    const summary = await this.summarySource(filter);
    return this.tableReport('Production Details', 'Report > Production Details', summary.data.reports.production || []);
  }

  async recentEntries(query) {
    const filter = parseReportFilter(query);
    const summary = await this.summarySource(filter);
    const updates = await this.inventoryService.recentUpdates({ filter });
    return recentEntriesReport('Recent Stock Entries', 'Report > Recent Stock Entries', summary.data.reports.stockEntry || [], updates, filter);
  }

  async summarySource(filter = undefined) {
    return this.store.source('getSummaryReports.json', filter);
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
          unit: shortUnit(row.unit),
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
          unit: shortUnit(product.unitName),
          type: stockStatus(quantity),
        };
      })
      .filter((item) => item.type !== 'in-stock')
      .sort((left, right) => left.quantity - right.quantity);
  }
}

function productCategories(stock) {
  const raw = rawSaltStock(stock);
  const categories = stock.data.inventory || [];
  const bundles = productRowsFromCategory(findCategory(categories, 'Bundle (unpacked)'));
  const rolls = productRowsFromCategory(findCategory(categories, 'Roll'));
  const bags = productRowsFromCategory(findCategory(categories, 'Bag (unpacked)'));
  const consumables = productRowsFromCategory(findCategory(categories, 'Consumables'));

  return [
    {
      title: 'Raw Salt Stock',
      items: [productInfoItem(raw.productGroup || 'Raw Salt', raw.qty, raw.unitName || 'Metric Ton')],
    },
    {
      title: 'Bundle (unpacked)',
      items: productInfoRows(bundles),
    },
    {
      title: 'Packaging - Rolls',
      items: productInfoRows(rolls),
    },
    {
      title: 'Packaging - Bags',
      items: productInfoRows(bags),
    },
    {
      title: 'Consumables',
      items: productInfoRows(consumables),
    },
  ].filter((category) => category.items.length > 0);
}

function productRowsFromCategory(category) {
  return (category?.products || []).map((product) => ({
    productGroup: product.productGroup,
    quantity: product.qty,
    unit: product.unitName,
  }));
}

function productInfoRows(rows) {
  return rows.map((row) => productInfoItem(row.productGroup, row.quantity, row.unit));
}

function productInfoItem(name, quantity, unit) {
  const value = numberOrZero(quantity);

  return {
    name: cleanText(name),
    quantity: value,
    unit: shortUnit(unit),
    status: uiStatus(stockStatus(value)),
  };
}

function recentStockEntries(rows, limit = 4) {
  return rows
    .filter(hasRecentEntryDate)
    .map((row) => ({
      type: 'inbound',
      label: cleanText(row.productGroup || row.productName),
      category: cleanText(row.productName || 'Stock Entry'),
      productName: cleanText(row.productGroup || row.productName),
      date: formatEntryDate(recentEntryDateValue(row)),
      quantity: `${numberOrZero(row.quantity).toLocaleString('en-US')} ${shortUnit(row.unit)}`,
      note: cleanText(row.note || row.remarks || row.description || ''),
      source: cleanText(row.plantName && row.plantName !== 'N/A' ? row.plantName : row.productName),
      icon: 'add_circle',
    }))
    .slice(0, limit);
}

function hasRecentEntryDate(row) {
  const value = recentEntryDateValue(row);

  if (!value || !cleanText(row.productGroup || row.productName)) {
    return false;
  }

  return !Number.isNaN(new Date(value).getTime());
}

function recentEntryDateValue(row) {
  return row.createdAt || row.entryDate || row.date || row.documentDate || row.reportDate || row.updatedAt;
}

function recentEntriesReport(title, description, rows, updates = [], filter = null) {
  const updateItems = updates.map((update) => ({
    productGroup: cleanText(update.productGroup),
    category: cleanText(update.category),
    note: cleanText(update.note || 'Owner inventory update'),
    subLabel: cleanText(update.category),
    quantity: numberOrZero(update.quantity),
    unit: shortUnit(update.unit),
    status: stockStatus(update.quantity),
    createdAt: update.createdAt,
  }));
  const apiItems = rows.filter(hasRecentEntryDate).map((row) => {
    const quantity = numberOrZero(row.quantity);

    return {
      productGroup: cleanText(row.productGroup || row.productName),
      category: cleanText(row.productName || 'Stock Entry'),
      note: cleanText(row.note || row.remarks || row.description || ''),
      subLabel: cleanText(row.productName),
      quantity,
      unit: shortUnit(row.unit),
      status: stockStatus(quantity),
      createdAt: recentEntryDateValue(row),
    };
  });

  return {
    title,
    description,
    filter,
    breadcrumb: description.split('>').map((item) => item.trim()),
    items: [...updateItems, ...apiItems].sort((left, right) => {
      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    }),
  };
}

function formatEntryDate(value) {
  if (!value) {
    return 'Just now';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Just now';
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function stockCard(title, value, unit) {
  const quantity = numberOrZero(value);
  const status = stockStatus(quantity);
  const color = statusColor(status);

  return {
    title,
    value: quantity.toLocaleString('en-US'),
    unit: shortUnit(unit),
    status: color,
  };
}

function stockTotals(stock) {
  const categories = stock.data.inventory || [];
  const raw = rawSaltStock(stock);

  return {
    all: allInventoryProducts(stock).reduce((sum, item) => sum + numberOrZero(item.qty), numberOrZero(raw.qty)),
    rawKg: numberOrZero(raw.qty) * 1000,
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
      unit: shortUnit(product.unitName),
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

const dayMs = 86_400_000;
const istOffsetMs = 330 * 60_000;

function analyticsForPeriod(rows, filter) {
  const buckets = bucketsForFilter(filter);
  const label = isCustomReportRange(filter)
    ? 'Bundles Packed (selected range)'
    : `Bundles Packed (${filter.period})`;

  return {
    label,
    data: seriesForBuckets(rows, filter, buckets),
    labels: buckets.map((bucket) => bucket.label),
  };
}

function bucketsForFilter(filter) {
  const period = filter?.period || 'daily';

  if (!isCustomReportRange(filter)) {
    return labelsForPeriod(period).map((label) => ({ label }));
  }

  const range = dateRangeForFilter(filter);
  const dayCount = Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / dayMs));

  if (dayCount <= 14) {
    return Array.from({ length: dayCount }, (_, index) => {
      const start = addDays(range.start, index);

      return {
        label: formatRangeDate(start),
        start,
        end: addDays(start, 1),
      };
    });
  }

  if (dayCount <= 62) {
    const bucketCount = Math.ceil(dayCount / 7);

    return Array.from({ length: bucketCount }, (_, index) => {
      const start = addDays(range.start, index * 7);
      const end = new Date(Math.min(addDays(start, 7).getTime(), range.end.getTime()));
      const endLabelDate = new Date(end.getTime() - 1000);

      return {
        label: `${formatRangeDate(start)}-${formatRangeDate(endLabelDate, { dayOnly: sameMonthInIndia(start, endLabelDate) })}`,
        start,
        end,
      };
    });
  }

  return monthBuckets(range);
}

function seriesForBuckets(rows, filter, bucketDefinitions) {
  const buckets = Array.from({ length: bucketDefinitions.length }, () => 0);
  const datedRows = (rows || []).filter((row) => rowDate(row));

  if (datedRows.length > 0) {
    datedRows.forEach((row) => {
      const bucketIndex = bucketIndexForFilter(rowDate(row), filter, bucketDefinitions);

      if (bucketIndex >= 0) {
        buckets[bucketIndex] += numberOrZero(row.quantity);
      }
    });
    return buckets.map((value) => Math.round(value));
  }

  return bucketQuantities(rows, bucketDefinitions.length);
}

function bucketIndexForFilter(value, filter, bucketDefinitions) {
  if (isCustomReportRange(filter)) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return -1;
    }

    return bucketDefinitions.findIndex((bucket) => {
      return bucket.start && bucket.end && date >= bucket.start && date < bucket.end;
    });
  }

  return bucketIndexForPeriod(value, filter?.period || 'daily', bucketDefinitions.length);
}

function isCustomReportRange(filter) {
  return filter?.period === 'custom' || filter?.rangeType === 'custom';
}

function bucketIndexForPeriod(value, period, bucketCount) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  if (period === 'weekly') {
    return (date.getDay() + 6) % 7;
  }

  if (period === 'monthly') {
    return Math.min(bucketCount - 1, Math.floor((date.getDate() - 1) / 7));
  }

  return Math.min(bucketCount - 1, Math.floor(date.getHours() / 4));
}

function monthBuckets(range) {
  const buckets = [];
  let cursor = range.start;

  while (cursor < range.end) {
    const parts = indiaDateParts(cursor);
    const nextMonth = indiaLocalToUtc(parts.year, parts.monthIndex + 1, 1);
    const end = new Date(Math.min(nextMonth.getTime(), range.end.getTime()));

    buckets.push({
      label: formatRangeDate(cursor, { monthOnly: true }),
      start: cursor,
      end,
    });

    cursor = end;
  }

  return buckets.length > 0 ? buckets : [{ label: formatRangeDate(range.start), start: range.start, end: range.end }];
}

function addDays(date, days) {
  return new Date(date.getTime() + days * dayMs);
}

function formatRangeDate(date, options = {}) {
  if (options.monthOnly) {
    return date.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'short' });
  }

  if (options.dayOnly) {
    return date.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', day: 'numeric' });
  }

  return date.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' });
}

function sameMonthInIndia(left, right) {
  const leftParts = indiaDateParts(left);
  const rightParts = indiaDateParts(right);
  return leftParts.year === rightParts.year && leftParts.monthIndex === rightParts.monthIndex;
}

function indiaDateParts(date) {
  const indiaDate = new Date(date.getTime() + istOffsetMs);

  return {
    year: indiaDate.getUTCFullYear(),
    monthIndex: indiaDate.getUTCMonth(),
    day: indiaDate.getUTCDate(),
  };
}

function indiaLocalToUtc(year, monthIndex, day) {
  return new Date(Date.UTC(year, monthIndex, day, 0, -330, 0, 0));
}

function rowDate(row) {
  return row?.createdAt || row?.entryDate || row?.date || row?.documentDate || row?.reportDate || row?.updatedAt || null;
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
