import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timer } from 'rxjs';
import { retry } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  DashboardData,
  OverallReportData,
  StockReportData,
  ProductInfoData,
  InventoryTableData,
  PackagingInventoryData,
  InventoryUpdateRequest,
  InventoryUpdateResponse,
  DatePeriod
} from '../models/inventory.models';

export interface DateFilterParams {
  period: DatePeriod;
  date: string;
  fromDate?: string;
  toDate?: string;
  rangeType?: 'custom';
}

@Injectable({ providedIn: 'root' })
export class DataService {
  private apiBaseUrl = environment.apiBaseUrl.replace(/\/$/, '');
  private apiHeaders: Record<string, string> = environment.apiKey
    ? { 'x-ledgerflow-api-key': environment.apiKey }
    : {};

  constructor(private http: HttpClient) {}

  getDashboard(filter?: DateFilterParams): Observable<DashboardData> {
    return this.getData<DashboardData>('/api/dashboard', filter);
  }

  getOverallReport(filter?: DateFilterParams): Observable<OverallReportData> {
    return this.getData<OverallReportData>('/api/reports/overall', filter);
  }

  getStockReport(filter?: DateFilterParams): Observable<StockReportData> {
    return this.getData<StockReportData>('/api/reports/stock', filter);
  }

  getProductInfo(): Observable<ProductInfoData> {
    return this.getData<ProductInfoData>('/api/products/info');
  }

  getBundleInventory(filter?: DateFilterParams): Observable<InventoryTableData> {
    return this.getData<InventoryTableData>('/api/inventory/bundles', filter);
  }

  getRawSaltInventory(filter?: DateFilterParams): Observable<InventoryTableData> {
    return this.getData<InventoryTableData>('/api/inventory/raw-salt', filter);
  }

  getPackagingInventory(filter?: DateFilterParams): Observable<PackagingInventoryData> {
    return this.getData<PackagingInventoryData>('/api/inventory/packaging', filter);
  }

  getConsumablesInventory(filter?: DateFilterParams): Observable<InventoryTableData> {
    return this.getData<InventoryTableData>('/api/inventory/consumables', filter);
  }

  getCrystallineInventory(filter?: DateFilterParams): Observable<InventoryTableData> {
    return this.getData<InventoryTableData>('/api/inventory/crystalline', filter);
  }

  getProductionLog(): Observable<InventoryTableData> {
    return this.getData<InventoryTableData>('/api/reports/production-log');
  }

  getRecentEntries(filter?: DateFilterParams): Observable<InventoryTableData> {
    return this.getData<InventoryTableData>('/api/reports/recent-entries', filter);
  }

  createInventoryUpdate(payload: InventoryUpdateRequest): Observable<InventoryUpdateResponse> {
    return this.http.post<InventoryUpdateResponse>(`${this.apiBaseUrl}/api/inventory/updates`, payload, { headers: this.apiHeaders });
  }

  private getData<T>(apiPath: string, filter?: DateFilterParams): Observable<T> {
    const searchParams = new URLSearchParams();

    if (filter) {
      searchParams.set('period', filter.period);
      searchParams.set('date', filter.date);

      if (filter.fromDate) {
        searchParams.set('fromDate', filter.fromDate);
      }

      if (filter.toDate) {
        searchParams.set('toDate', filter.toDate);
      }

      if (filter.rangeType) {
        searchParams.set('rangeType', filter.rangeType);
      }
    }

    const params = searchParams.toString() ? `?${searchParams.toString()}` : '';

    return this.http.get<T>(`${this.apiBaseUrl}${apiPath}${params}`, { headers: this.apiHeaders }).pipe(
      retry({
        count: 1,
        delay: () => timer(500),
      })
    );
  }
}
