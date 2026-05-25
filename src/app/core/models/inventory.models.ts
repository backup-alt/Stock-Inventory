// ===== Common Types =====
export type TrendDirection = 'up' | 'down' | 'flat';
export type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock';
export type StatusColor = 'green' | 'yellow' | 'red';
export type EntryType = 'inbound' | 'outbound';
export type DatePeriod = 'daily' | 'weekly' | 'monthly' | 'custom';

// ===== Dashboard =====
export interface Trend {
  direction: TrendDirection;
  percentage: string;
}

export interface KpiCard {
  label: string;
  value: string | number;
  icon: string;
  unit?: string;
  trend?: Trend;
  footer?: string;
}

export interface CriticalStockItem {
  name: string;
  quantity: number;
  unit: string;
  type: string;
}

export interface NormalStockItem {
  name: string;
  quantity: number;
  unit: string;
  status: string;
  icon: string;
}

export interface InventoryBreakdownItem {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  alert: boolean;
}

export interface DashboardData {
  greeting: string;
  subtitle: string;
  kpis: KpiCard[];
  criticalStock: CriticalStockItem[];
  normalStock: NormalStockItem[];
  inventoryBreakdown: InventoryBreakdownItem[];
}

// ===== Overall Report =====
export interface TargetInfo {
  label: string;
  percentage: number;
}

export interface ProgressInfo {
  label: string;
  percentage: number;
}

export interface BadgeInfo {
  text: string;
  icon: string;
}

export interface ReportKpiCard {
  label: string;
  value: string | number;
  unit?: string;
  icon: string;
  trend?: Trend;
  target?: TargetInfo;
  progress?: ProgressInfo;
  badge?: BadgeInfo;
  footer?: string;
}

export interface AnalyticsData {
  label: string;
  data: number[];
  labels: string[];
}

export interface OverallReportData {
  title: string;
  kpis: ReportKpiCard[];
  analytics: {
    bundlesPacked: AnalyticsData;
    materialConsumed: AnalyticsData;
    newStock: AnalyticsData;
    orders: AnalyticsData;
  };
}

// ===== Stock Report =====
export interface StockReportCard {
  title: string;
  value: string | number;
  unit: string;
  status: StatusColor;
  trend?: {
    direction: TrendDirection;
    text: string;
  };
}

export interface StockReportData {
  title: string;
  cards: StockReportCard[];
}

// ===== Product Info =====
export interface ProductHero {
  title: string;
  lotNumber: string;
  status: string;
}

export interface RecentEntry {
  type: EntryType;
  label: string;
  category?: string;
  productName?: string;
  date: string;
  quantity: string;
  note?: string;
  source: string;
  icon: string;
}

export interface InventoryItem {
  name: string;
  quantity: number;
  unit: string;
  status: string;
}

export interface InventoryCategory {
  title: string;
  items: InventoryItem[];
}

export interface InventoryUpdateRequest {
  category: string;
  productGroup: string;
  quantity: number;
  unit?: string;
  note?: string;
}

export interface InventoryUpdateResponse {
  success: boolean;
  data: {
    id: string;
    category: string;
    categorySlug: string;
    productGroup: string;
    quantity: number;
    unit: string;
    status: StockStatus;
    note: string;
    createdAt: string;
  };
}

export interface ProductInfoData {
  hero: ProductHero;
  productionHighlights: {
    avgMonthlyYield: {
      value: number;
      unit: string;
    };
  };
  recentEntries: RecentEntry[];
  inventoryCategories: InventoryCategory[];
}

// ===== Inventory Tables (shared by multiple pages) =====
export interface InventoryTableItem {
  productGroup: string;
  category?: string;
  subLabel?: string | null;
  note?: string;
  createdAt?: string;
  quantity: number;
  unit: string;
  status: string;
}

export interface InventoryTableData {
  title: string;
  description?: string;
  breadcrumb: string[];
  items: InventoryTableItem[];
}

// ===== Packaging Inventory (special: has rolls + bags) =====
export interface PackagingInventoryData {
  title: string;
  description: string;
  breadcrumb: string[];
  rolls: InventoryTableItem[];
  bags: InventoryTableItem[];
}
