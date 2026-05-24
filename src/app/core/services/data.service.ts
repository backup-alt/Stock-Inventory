import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DashboardData,
  OverallReportData,
  StockReportData,
  ProductInfoData,
  InventoryTableData,
  PackagingInventoryData
} from '../models/inventory.models';

@Injectable({ providedIn: 'root' })
export class DataService {
  private assetBaseUrl = 'assets/data/';
  private apiBaseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  constructor(private http: HttpClient) {}

  getDashboard(): Observable<DashboardData> {
    return this.getData<DashboardData>('/api/dashboard', 'dashboard.json');
  }

  getOverallReport(): Observable<OverallReportData> {
    return this.getData<OverallReportData>('/api/reports/overall', 'overall-report.json');
  }

  getStockReport(): Observable<StockReportData> {
    return this.getData<StockReportData>('/api/reports/stock', 'stock-report.json');
  }

  getProductInfo(): Observable<ProductInfoData> {
    return this.getData<ProductInfoData>('/api/products/info', 'product-info.json');
  }

  getBundleInventory(): Observable<InventoryTableData> {
    return this.getData<InventoryTableData>('/api/inventory/bundles', 'inventory-bundles.json');
  }

  getRawSaltInventory(): Observable<InventoryTableData> {
    return this.getData<InventoryTableData>('/api/inventory/raw-salt', 'inventory-raw-salt.json');
  }

  getPackagingInventory(): Observable<PackagingInventoryData> {
    return this.getData<PackagingInventoryData>('/api/inventory/packaging', 'inventory-packaging.json');
  }

  getConsumablesInventory(): Observable<InventoryTableData> {
    return this.getData<InventoryTableData>('/api/inventory/consumables', 'inventory-consumables.json');
  }

  getCrystallineInventory(): Observable<InventoryTableData> {
    return this.getData<InventoryTableData>('/api/inventory/crystalline', 'inventory-crystalline.json');
  }

  getProductionLog(): Observable<InventoryTableData> {
    return this.getData<InventoryTableData>('/api/reports/production-log', 'production-log.json');
  }

  getRecentEntries(): Observable<InventoryTableData> {
    return this.getData<InventoryTableData>('/api/reports/recent-entries', 'recent-entries.json');
  }

  private getData<T>(apiPath: string, assetFile: string): Observable<T> {
    const assetRequest = this.http.get<T>(`${this.assetBaseUrl}${assetFile}`);

    if (!this.apiBaseUrl) {
      return assetRequest;
    }

    return this.http.get<T>(`${this.apiBaseUrl}${apiPath}`).pipe(
      catchError(() => assetRequest)
    );
  }
}
