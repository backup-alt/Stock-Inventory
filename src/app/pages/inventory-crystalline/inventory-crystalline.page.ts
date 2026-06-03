import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DataService } from '../../core/services/data.service';
import { DateFilterService } from '../../core/services/date-filter.service';
import { DateRangePageBase } from '../../core/services/date-range-page-base';
import { InventoryTableData } from '../../core/models/inventory.models';

@Component({
  selector: 'app-inventory-crystalline',
  templateUrl: './inventory-crystalline.page.html',
  styleUrls: ['./inventory-crystalline.page.scss'],
  standalone: false,
})
export class InventoryCrystallinePage extends DateRangePageBase implements OnInit {
  data: InventoryTableData | null = null;
  isLoading = true;
  hasError = false;

  constructor(
    private dataService: DataService,
    private router: Router,
    dateFilter: DateFilterService
  ) {
    super(dateFilter);
  }

  ngOnInit() {
    this.initializeDateFilter();
    this.loadData();
  }

  loadData(refresher?: any) {
    if (!refresher && !this.data) {
      this.isLoading = true;
    }
    this.hasError = false;
    const request = this.isProductInventoryRoute
      ? this.dataService.getProductInventory(this.dateQuery())
      : this.dataService.getCrystallineInventory(this.dateQuery());

    request.subscribe({
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

  get errorTitle(): string {
    return this.isProductInventoryRoute ? 'Product Inventory' : 'Crystalline Inventory';
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

  protected onDateFilterChanged(): void {
    this.loadData();
  }

  private get isProductInventoryRoute(): boolean {
    return this.router.url.includes('product-inventory');
  }
}
