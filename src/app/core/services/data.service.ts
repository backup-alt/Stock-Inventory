import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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
  private apiBaseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  constructor(private http: HttpClient) {}

  getDashboard(): Observable<DashboardData> {
    return this.getData<DashboardData>('/api/dashboard');
  }

  getOverallReport(): Observable<OverallReportData> {
    return this.getData<OverallReportData>('/api/reports/overall');
  }

  getStockReport(): Observable<StockReportData> {
    return this.getData<StockReportData>('/api/reports/stock');
  }

  getProductInfo(): Observable<ProductInfoData> {
    return this.getData<ProductInfoData>('/api/products/info');
  }

  getBundleInventory(): Observable<InventoryTableData> {
    return this.getData<InventoryTableData>('/api/inventory/bundles');
  }

  getRawSaltInventory(): Observable<InventoryTableData> {
    return this.getData<InventoryTableData>('/api/inventory/raw-salt');
  }

  getPackagingInventory(): Observable<PackagingInventoryData> {
    return this.getData<PackagingInventoryData>('/api/inventory/packaging');
  }

  getConsumablesInventory(): Observable<InventoryTableData> {
    return this.getData<InventoryTableData>('/api/inventory/consumables');
  }

  getCrystallineInventory(): Observable<InventoryTableData> {
    return this.getData<InventoryTableData>('/api/inventory/crystalline');
  }

  getProductionLog(): Observable<InventoryTableData> {
    return this.getData<InventoryTableData>('/api/reports/production-log');
  }

  getRecentEntries(): Observable<InventoryTableData> {
    return this.getData<InventoryTableData>('/api/reports/recent-entries');
  }

  private getData<T>(apiPath: string): Observable<T> {
    return this.http.get<T>(`${this.apiBaseUrl}${apiPath}`);
  }
}
