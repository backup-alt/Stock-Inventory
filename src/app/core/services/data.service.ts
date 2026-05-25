import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Observable, throwError, timer } from 'rxjs';
import { map, retry } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { DateFilterService } from './date-filter.service';
import {
  CriticalStockItem,
  DashboardData,
  DatePeriod,
  InventoryBreakdownItem,
  InventoryCategory,
  InventoryItem,
  InventoryTableData,
  InventoryTableItem,
  InventoryUpdateRequest,
  InventoryUpdateResponse,
  KpiCard,
  NormalStockItem,
  OverallReportData,
  PackagingInventoryData,
  ProductInfoData,
  RecentEntry,
  StockReportCard,
  StockReportData,
} from '../models/inventory.models';

export interface DateFilterParams {
  period: DatePeriod;
  date: string;
  fromDate?: string;
  toDate?: string;
  rangeType?: 'custom';
}

interface InventoryRow {
  productGroup: string;
  quantity: number;
  unit: string;
  subLabel?: string | null;
}

interface ChartBucket {
  label: string;
  start?: Date;
  end?: Date;
}

interface SummaryReports {
  stockEntry: any[];
  production: any[];
  inventoryUsed: any[];
  orderPlaced: any[];
}

@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly summaryReportsUrl = environment.summaryReportsUrl;
  private readonly stockReportsUrl = environment.stockReportsUrl;

  constructor(
    private http: HttpClient,
    private dateFilter: DateFilterService
  ) {}

  getDashboard(filter?: DateFilterParams): Observable<DashboardData> {
    const reportFilter = filter ?? this.defaultFilter('weekly');

    return forkJoin({
      stock: this.stockSource(reportFilter),
      summary: this.summarySource(reportFilter),
    }).pipe(map(({ stock, summary }) => dashboardData(stock, summary, reportFilter)));
  }

  getOverallReport(filter?: DateFilterParams): Observable<OverallReportData> {
    const reportFilter = filter ?? this.defaultFilter('weekly');

    return this.summarySource(reportFilter).pipe(
      map((summary) => overallReportData(summary, reportFilter))
    );
  }

  getStockReport(filter?: DateFilterParams): Observable<StockReportData> {
    const reportFilter = filter ?? this.defaultFilter('daily');

    return this.stockSource(reportFilter).pipe(
      map((stock) => stockReportData(stock, reportFilter))
    );
  }

  getProductInfo(): Observable<ProductInfoData> {
    const reportFilter = this.defaultFilter('daily');

    return forkJoin({
      stock: this.stockSource(reportFilter),
      summary: this.summarySource(reportFilter),
    }).pipe(map(({ stock, summary }) => productInfoData(stock, summary)));
  }

  getBundleInventory(filter?: DateFilterParams): Observable<InventoryTableData> {
    return this.inventoryTable('bundles', filter);
  }

  getRawSaltInventory(filter?: DateFilterParams): Observable<InventoryTableData> {
    return this.inventoryTable('raw-salt', filter);
  }

  getPackagingInventory(filter?: DateFilterParams): Observable<PackagingInventoryData> {
    const reportFilter = filter ?? this.defaultFilter('weekly');

    return this.stockSource(reportFilter).pipe(
      map((stock) => {
        const rolls = productRows(stock, 'Roll').map(inventoryItem);
        const bags = productRows(stock, 'Bag (unpacked)').map(inventoryItem);

        return {
          title: 'Packaging Inventory',
          description: 'Current stock levels for roll and bag packaging materials across all zones.',
          breadcrumb: ['Stock', 'Packaging Inventory'],
          rolls,
          bags,
        };
      })
    );
  }

  getConsumablesInventory(filter?: DateFilterParams): Observable<InventoryTableData> {
    return this.inventoryTable('consumables', filter);
  }

  getCrystallineInventory(filter?: DateFilterParams): Observable<InventoryTableData> {
    return this.inventoryTable('crystalline', filter);
  }

  getProductionLog(): Observable<InventoryTableData> {
    const reportFilter = this.defaultFilter('daily');

    return this.summarySource(reportFilter).pipe(
      map((summary) => tableReport(
        'Production Details',
        'Report > Production Details',
        reportsFrom(summary).production || []
      ))
    );
  }

  getRecentEntries(filter?: DateFilterParams): Observable<InventoryTableData> {
    const reportFilter = filter ?? this.defaultFilter('daily');

    return this.summarySource(reportFilter).pipe(
      map((summary) => recentEntriesReport(
        'Recent Stock Entries',
        'Report > Recent Stock Entries',
        reportsFrom(summary).stockEntry || [],
        reportFilter
      ))
    );
  }

  createInventoryUpdate(_payload: InventoryUpdateRequest): Observable<InventoryUpdateResponse> {
    return throwError(() => new Error('Inventory updates are disabled for direct API mode.'));
  }

  private inventoryTable(slug: string, filter?: DateFilterParams): Observable<InventoryTableData> {
    const reportFilter = filter ?? this.defaultFilter('weekly');

    return this.stockSource(reportFilter).pipe(
      map((stock) => tableFromRows(slug, rowsForSlug(stock, slug)))
    );
  }

  private summarySource(filter: DateFilterParams): Observable<any> {
    return this.http.get<any>(this.reportUrl(this.summaryReportsUrl, filter)).pipe(reportRetry());
  }

  private stockSource(filter: DateFilterParams): Observable<any> {
    return this.http.get<any>(this.reportUrl(this.stockReportsUrl, filter)).pipe(reportRetry());
  }

  private reportUrl(url: string, filter: DateFilterParams): string {
    const reportUrl = new URL(url);

    if (filter.fromDate) {
      reportUrl.searchParams.set('fromDate', filter.fromDate);
    }

    if (filter.toDate) {
      reportUrl.searchParams.set('toDate', filter.toDate);
    }

    return reportUrl.toString();
  }

  private defaultFilter(period: DatePeriod): DateFilterParams {
    return this.dateFilter.buildFilter(period);
  }
}

function reportRetry<T>() {
  return retry<T>({
    count: 1,
    delay: () => timer(500),
  });
}

function dashboardData(stock: any, summary: any, filter: DateFilterParams): DashboardData {
  const lowStock = lowStockItems(stock);
  const totals = stockTotals(stock);
  const raw = rawSaltStock(stock);
  const reports = reportsFrom(summary);

  return {
    greeting: 'Good Morning, Owner',
    subtitle: `Live warehouse status for the selected ${filter.period.replace('-', ' ')}.`,
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
    ] as KpiCard[],
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
    ] as InventoryBreakdownItem[],
  };
}

function overallReportData(summary: any, filter: DateFilterParams): OverallReportData {
  const reports = reportsFrom(summary);
  const production = reports.production || [];
  const inventoryUsed = reports.inventoryUsed || [];
  const stockEntry = reports.stockEntry || [];
  const orderPlaced = reports.orderPlaced || [];

  return {
    title: 'Overall Report',
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
      bundlesPacked: analyticsForPeriod(production, filter),
      materialConsumed: analyticsForPeriod(inventoryUsed, filter),
      newStock: analyticsForPeriod(stockEntry, filter),
      orders: analyticsForPeriod(orderPlaced, filter),
    },
  };
}

function stockReportData(stock: any, _filter: DateFilterParams): StockReportData {
  const totals = stockTotals(stock);
  const raw = rawSaltStock(stock);

  return {
    title: 'Stock Report',
    cards: [
      stockCard('Raw Stock', raw?.qty, raw?.unitName || 'Metric Ton'),
      stockCard('Finished Goods', totals.bundles, 'Bundles'),
      stockCard('Packaging Bags', totals.bags, 'Total Bags'),
    ],
  };
}

function productInfoData(stock: any, summary: any): ProductInfoData {
  const reports = reportsFrom(summary);
  const productionTotal = totalQuantity(reports.production || []);

  return {
    hero: {
      title: 'Inventory',
      lotNumber: `Live snapshot - ${countRows(stock?.data?.inventory)} stock categories`,
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

function productCategories(stock: any): InventoryCategory[] {
  const raw = rawSaltStock(stock);

  return [
    {
      title: 'Raw Salt Stock',
      items: [productInfoItem(raw.productGroup || 'Raw Salt', raw.qty, raw.unitName || 'Metric Ton')],
    },
    {
      title: 'Bundle (unpacked)',
      items: productRows(stock, 'Bundle (unpacked)').map((row) => productInfoItem(row.productGroup, row.quantity, row.unit)),
    },
    {
      title: 'Packaging - Rolls',
      items: productRows(stock, 'Roll').map((row) => productInfoItem(row.productGroup, row.quantity, row.unit)),
    },
    {
      title: 'Packaging - Bags',
      items: productRows(stock, 'Bag (unpacked)').map((row) => productInfoItem(row.productGroup, row.quantity, row.unit)),
    },
    {
      title: 'Consumables',
      items: productRows(stock, 'Consumables').map((row) => productInfoItem(row.productGroup, row.quantity, row.unit)),
    },
  ].filter((category) => category.items.length > 0);
}

function productInfoItem(name: string, quantity: unknown, unit: string): InventoryItem {
  const value = numberOrZero(quantity);

  return {
    name: cleanText(name),
    quantity: value,
    unit: shortUnit(unit),
    status: uiStatus(stockStatus(value)),
  };
}

function rowsForSlug(stock: any, slug: string): InventoryRow[] {
  if (slug === 'bundles') {
    return productRows(stock, 'Bundle (unpacked)');
  }

  if (slug === 'raw-salt') {
    const raw = rawSaltStock(stock);
    return [{ productGroup: raw.productGroup || 'Raw Salt', quantity: numberOrZero(raw.qty), unit: raw.unitName || 'Metric Ton' }];
  }

  if (slug === 'consumables') {
    return productRows(stock, 'Consumables');
  }

  if (slug === 'crystalline') {
    return crystallineRows(stock);
  }

  return [];
}

function tableFromRows(slug: string, rows: InventoryRow[]): InventoryTableData {
  const title = categoryTitle(slug);

  return {
    title,
    description: `${title} from the current inventory snapshot.`,
    breadcrumb: ['Stock', title],
    items: rows.map(inventoryItem),
  };
}

function tableReport(title: string, description: string, rows: any[]): InventoryTableData {
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

function inventoryItem(item: InventoryRow): InventoryTableItem {
  const quantity = numberOrZero(item.quantity);

  return {
    productGroup: cleanText(item.productGroup),
    subLabel: item.subLabel ? cleanText(item.subLabel) : null,
    quantity,
    unit: shortUnit(item.unit),
    status: stockStatus(quantity),
  };
}

function recentEntriesReport(title: string, description: string, rows: any[], filter: DateFilterParams): InventoryTableData {
  const items = rows
    .filter(hasRecentEntryDate)
    .filter((row) => dateMatchesFilter(recentEntryDateValue(row), filter))
    .map((row) => {
      const quantity = numberOrZero(row.quantity);

      return {
        productGroup: cleanText(row.productGroup || row.productName),
        category: cleanText(row.productName || 'Stock Entry'),
        note: cleanText(row.note || row.remarks || row.description || ''),
        subLabel: cleanText(row.productName),
        quantity,
        unit: shortUnit(row.unit),
        status: stockStatus(quantity),
        createdAt: recentEntryDateValue(row) || undefined,
      };
    })
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());

  return {
    title,
    description,
    breadcrumb: description.split('>').map((item) => item.trim()),
    items,
  };
}

function recentStockEntries(rows: any[], limit = 4): RecentEntry[] {
  return rows
    .filter(hasRecentEntryDate)
    .map((row) => ({
      type: 'inbound' as const,
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

function analyticsForPeriod(rows: any[], filter: DateFilterParams) {
  const buckets = bucketsForFilter(filter);
  const label = filter.rangeType === 'custom'
    ? 'Bundles Packed (selected range)'
    : `Bundles Packed (${filter.period})`;

  return {
    label,
    data: seriesForBuckets(rows, filter, buckets),
    labels: buckets.map((bucket) => bucket.label),
  };
}

function bucketsForFilter(filter: DateFilterParams): ChartBucket[] {
  if (filter.rangeType !== 'custom') {
    return labelsForPeriod(filter.period).map((label) => ({ label }));
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

function seriesForBuckets(rows: any[], filter: DateFilterParams, bucketDefinitions: ChartBucket[]): number[] {
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

function bucketIndexForFilter(value: string | null, filter: DateFilterParams, bucketDefinitions: ChartBucket[]): number {
  const date = value ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return filter.rangeType === 'custom' ? -1 : 0;
  }

  if (filter.rangeType === 'custom') {
    return bucketDefinitions.findIndex((bucket) => {
      return Boolean(bucket.start && bucket.end && date >= bucket.start && date < bucket.end);
    });
  }

  if (filter.period === 'weekly') {
    return (date.getDay() + 6) % 7;
  }

  if (filter.period === 'monthly') {
    return Math.min(bucketDefinitions.length - 1, Math.floor((date.getDate() - 1) / 7));
  }

  return Math.min(bucketDefinitions.length - 1, Math.floor(date.getHours() / 4));
}

function labelsForPeriod(period: DatePeriod): string[] {
  if (period === 'weekly') {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  }

  if (period === 'monthly') {
    return ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
  }

  return ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
}

function monthBuckets(range: { start: Date; end: Date }): ChartBucket[] {
  const buckets: ChartBucket[] = [];
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

function stockCard(title: string, value: unknown, unit: string): StockReportCard {
  const quantity = numberOrZero(value);
  const status = stockStatus(quantity);
  const color = statusColor(status);

  return {
    title,
    value: quantity.toLocaleString('en-US'),
    unit: shortUnit(unit),
    status: color,
    trend: {
      direction: color === 'red' ? 'down' : 'up',
      text: color === 'red' ? 'Needs attention' : 'Live snapshot',
    },
  };
}

function stockTotals(stock: any) {
  const categories = stock?.data?.inventory || [];
  const raw = rawSaltStock(stock);

  return {
    all: allInventoryProducts(stock).reduce((sum, item) => sum + numberOrZero(item.qty), numberOrZero(raw.qty)),
    rawKg: numberOrZero(raw.qty) * 1000,
    bundles: totalProductQuantity(findCategory(categories, 'Bundle (unpacked)')),
    rolls: totalProductQuantity(findCategory(categories, 'Roll')),
    bags: totalProductQuantity(findCategory(categories, 'Bag (unpacked)')),
  };
}

function productRows(stock: any, productName: string): InventoryRow[] {
  const category = findCategory(stock?.data?.inventory || [], productName);

  return (category?.products || []).map((product: any) => ({
    productGroup: product.productGroup,
    quantity: numberOrZero(product.qty),
    unit: product.unitName,
  }));
}

function crystallineRows(stock: any): InventoryRow[] {
  return (stock?.data?.finishedGoods || []).flatMap((plant: any) => {
    return (plant.groups || [])
      .filter((group: any) => cleanText(group.productGroup).toLowerCase().includes('crystal'))
      .flatMap((group: any) => {
        return (group.products || []).map((product: any) => ({
          productGroup: product.productBrand,
          subLabel: cleanText(group.productGroup),
          quantity: numberOrZero(product.qty),
          unit: product.unitName,
        }));
      });
  });
}

function lowStockItems(stock: any): CriticalStockItem[] {
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

function topStockItems(stock: any): NormalStockItem[] {
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

function rawSaltStock(source: any): any {
  const rawStock = source?.data?.rawSaltStock;

  if (Array.isArray(rawStock)) {
    return rawStock[0] || {};
  }

  return rawStock || {};
}

function allInventoryProducts(stock: any): any[] {
  return (stock?.data?.inventory || []).flatMap((category: any) => category.products || []);
}

function findCategory(categories: any[], productName: string): any {
  return categories.find((item) => cleanText(item.productName) === productName);
}

function totalProductQuantity(category: any): number {
  return (category?.products || []).reduce((sum: number, item: any) => sum + numberOrZero(item.qty), 0);
}

function reportsFrom(summary: any): SummaryReports {
  const reports = summary?.data?.reports || {};

  return {
    stockEntry: Array.isArray(reports.stockEntry) ? reports.stockEntry : [],
    production: Array.isArray(reports.production) ? reports.production : [],
    inventoryUsed: Array.isArray(reports.inventoryUsed) ? reports.inventoryUsed : [],
    orderPlaced: Array.isArray(reports.orderPlaced) ? reports.orderPlaced : [],
  };
}

function totalQuantity(rows: any[]): number {
  return (rows || []).reduce((sum, row) => sum + numberOrZero(row.quantity), 0);
}

function countRows(rows: any): number {
  return Array.isArray(rows) ? rows.length : 0;
}

function hasRecentEntryDate(row: any): boolean {
  const value = recentEntryDateValue(row);

  if (!value || !cleanText(row.productGroup || row.productName)) {
    return false;
  }

  return !Number.isNaN(new Date(value).getTime());
}

function recentEntryDateValue(row: any): string | null {
  return row.createdAt || row.entryDate || row.date || row.documentDate || row.reportDate || row.updatedAt || null;
}

function rowDate(row: any): string | null {
  return recentEntryDateValue(row);
}

function dateMatchesFilter(value: string | null, filter: DateFilterParams): boolean {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const range = dateRangeForFilter(filter);
  return date >= range.start && date < range.end;
}

function dateRangeForFilter(filter: DateFilterParams): { start: Date; end: Date } {
  if (filter.fromDate && filter.toDate) {
    return {
      start: new Date(filter.fromDate),
      end: new Date(new Date(filter.toDate).getTime() + 1000),
    };
  }

  const selected = parseInputDate(filter.date);

  if (filter.period === 'monthly') {
    return {
      start: new Date(selected.getFullYear(), selected.getMonth(), 1),
      end: new Date(selected.getFullYear(), selected.getMonth() + 1, 1),
    };
  }

  if (filter.period === 'weekly') {
    const start = new Date(selected);
    const mondayOffset = (selected.getDay() + 6) % 7;
    start.setDate(selected.getDate() - mondayOffset);
    return { start, end: addDays(start, 7) };
  }

  return { start: selected, end: addDays(selected, 1) };
}

function parseInputDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function bucketQuantities(rows: any[], bucketCount: number): number[] {
  const buckets = Array.from({ length: bucketCount }, () => 0);

  rows.forEach((row, index) => {
    buckets[index % bucketCount] += numberOrZero(row.quantity);
  });

  return buckets.map((value) => Math.round(value));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * dayMs);
}

function formatRangeDate(date: Date, options: { dayOnly?: boolean; monthOnly?: boolean } = {}): string {
  if (options.monthOnly) {
    return date.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'short' });
  }

  if (options.dayOnly) {
    return date.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', day: 'numeric' });
  }

  return date.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' });
}

function sameMonthInIndia(left: Date, right: Date): boolean {
  const leftParts = indiaDateParts(left);
  const rightParts = indiaDateParts(right);
  return leftParts.year === rightParts.year && leftParts.monthIndex === rightParts.monthIndex;
}

function indiaDateParts(date: Date): { year: number; monthIndex: number; day: number } {
  const indiaDate = new Date(date.getTime() + istOffsetMs);

  return {
    year: indiaDate.getUTCFullYear(),
    monthIndex: indiaDate.getUTCMonth(),
    day: indiaDate.getUTCDate(),
  };
}

function indiaLocalToUtc(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, 0, -330, 0, 0));
}

function formatEntryDate(value: string | null): string {
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

function categoryTitle(slug: string): string {
  const titles: Record<string, string> = {
    bundles: 'Bundle Inventory',
    'raw-salt': 'Raw Salt Inventory',
    packaging: 'Packaging Inventory',
    'packaging-rolls': 'Packaging Rolls Inventory',
    'packaging-bags': 'Packaging Bags Inventory',
    consumables: 'Consumables Inventory',
    crystalline: 'Product Inventory',
  };

  return titles[slug] || titleFromSlug(slug);
}

function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function shortUnit(value: unknown): string {
  const unit = cleanText(value);
  const normalized = unit.toLowerCase();

  if (normalized === 'kilogram' || normalized === 'kilograms') {
    return 'kg';
  }

  if (normalized === 'metric ton' || normalized === 'metric tons') {
    return 'MT';
  }

  return unit;
}

function numberOrZero(value: unknown): number {
  const number = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function stockStatus(quantity: unknown): 'in-stock' | 'low-stock' | 'out-of-stock' {
  const value = numberOrZero(quantity);

  if (value <= 0) {
    return 'out-of-stock';
  }

  if (value <= 100) {
    return 'low-stock';
  }

  return 'in-stock';
}

function statusColor(status: string): 'green' | 'yellow' | 'red' {
  if (status === 'out-of-stock' || status === 'critical') {
    return 'red';
  }

  if (status === 'low-stock' || status === 'low') {
    return 'yellow';
  }

  return 'green';
}

function uiStatus(status: string): string {
  if (status === 'out-of-stock') {
    return 'critical';
  }

  if (status === 'low-stock') {
    return 'low';
  }

  return 'ok';
}

function compactNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}m`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }

  return String(value);
}

const dayMs = 86_400_000;
const istOffsetMs = 330 * 60_000;
