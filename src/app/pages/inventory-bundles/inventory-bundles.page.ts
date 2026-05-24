import { Component, OnInit } from '@angular/core';
import { DataService } from '../../core/services/data.service';
import { DateFilterService } from '../../core/services/date-filter.service';
import { DatePeriod, InventoryTableData } from '../../core/models/inventory.models';

@Component({
  selector: 'app-inventory-bundles',
  templateUrl: './inventory-bundles.page.html',
  styleUrls: ['./inventory-bundles.page.scss'],
  standalone: false,
})
export class InventoryBundlesPage implements OnInit {
  data: InventoryTableData | null = null;
  isLoading = true;
  hasError = false;
  activePeriod: DatePeriod = 'daily';
  currentDate = '';

  constructor(
    private dataService: DataService,
    private dateFilter: DateFilterService
  ) {}

  ngOnInit() {
    this.activePeriod = this.dateFilter.getCurrentPeriod();
    this.currentDate = this.dateFilter.getFormattedDate(this.activePeriod);
    this.loadData();
  }

  setPeriod(period: string) {
    this.activePeriod = period as DatePeriod;
    this.dateFilter.setPeriod(this.activePeriod);
    this.currentDate = this.dateFilter.getFormattedDate(this.activePeriod);
  }

  loadData(refresher?: any) {
    if (!refresher) {
      this.isLoading = true;
    }
    this.hasError = false;
    this.dataService.getBundleInventory().subscribe({
      next: (data) => {
        this.data = data;
        this.isLoading = false;
        this.completeRefresh(refresher);
      },
      error: () => {
        this.hasError = true;
        this.isLoading = false;
        this.completeRefresh(refresher);
      }
    });
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'in-stock': return 'check_circle';
      case 'low-stock': return 'warning_amber';
      case 'out-of-stock': return 'error';
      default: return 'check_circle';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'in-stock': return 'In Stock';
      case 'low-stock': return 'Low Stock';
      case 'out-of-stock': return 'Out of Stock';
      default: return status;
    }
  }

  private completeRefresh(refresher?: any) {
    if (!refresher) {
      return;
    }

    setTimeout(() => refresher.target?.complete(), 500);
  }
}
