import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DataService } from '../core/services/data.service';
import { DateFilterService } from '../core/services/date-filter.service';
import { DateRangePageBase } from '../core/services/date-range-page-base';
import { CriticalStockItem, DashboardData, InventoryBreakdownItem, KpiCard } from '../core/models/inventory.models';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page extends DateRangePageBase implements OnInit {
  data: DashboardData | null = null;
  isLoading = true;
  hasError = false;
  private baseData: DashboardData | null = null;

  constructor(
    private dataService: DataService,
    dateFilter: DateFilterService,
    private router: Router
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
    this.dataService.getDashboard(this.dateQuery()).subscribe({
      next: (data) => {
        this.baseData = data;
        this.applyDemoPeriod();
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

  navigateKpi(kpi: KpiCard) {
    const label = kpi.label.toLowerCase();

    if (label.includes('total stock')) {
      this.navigateTo('stock-report');
      return;
    }

    if (label.includes('orders')) {
      this.navigateTo('overall-report');
      return;
    }

    if (label.includes('deliver')) {
      this.navigateTo('production-log');
      return;
    }

    if (label.includes('pending')) {
      this.navigateTo('recent-entries');
      return;
    }
  }

  openCriticalStock() {
    this.navigateTo('stock-report');
  }

  navigateCriticalStock(item: CriticalStockItem) {
    const name = item.name.toLowerCase();
    const target = name.includes('iodine') ? 'inventory/consumables' : 'inventory/packaging';
    this.navigateTo(target);
  }

  navigateNormalStock() {
    this.navigateTo('inventory/raw-salt');
  }

  navigateBreakdown(item: InventoryBreakdownItem) {
    const label = item.label.toLowerCase();

    if (label.includes('raw')) {
      this.navigateTo('inventory/raw-salt');
      return;
    }

    if (label.includes('finished')) {
      this.navigateTo('inventory/bundles');
      return;
    }

    if (label.includes('bag') || label.includes('pkg')) {
      this.navigateTo('inventory/packaging');
      return;
    }

    this.navigateTo('stock-report');
  }

  private applyDemoPeriod() {
    if (!this.baseData) {
      return;
    }

    const nextData = this.clone(this.baseData);
    this.updateCurrentDate();
    this.data = nextData;
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private navigateTo(route: string) {
    this.router.navigate(['/tabs', route]);
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
}
