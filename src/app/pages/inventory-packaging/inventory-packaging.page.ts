import { Component, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { DataService } from '../../core/services/data.service';
import { InventoryTableItem, PackagingInventoryData } from '../../core/models/inventory.models';
import { filter } from 'rxjs';

type PackagingViewMode = 'all' | 'rolls' | 'bags';

interface PackagingDisplayRow {
  item: InventoryTableItem;
  label: string;
}

@Component({
  selector: 'app-inventory-packaging',
  templateUrl: './inventory-packaging.page.html',
  styleUrls: ['./inventory-packaging.page.scss'],
  standalone: false,
})
export class InventoryPackagingPage implements OnInit {
  data: PackagingInventoryData | null = null;
  isLoading = true;
  hasError = false;
  viewMode: PackagingViewMode = 'all';
  displayRows: PackagingDisplayRow[] = [];

  constructor(
    private dataService: DataService,
    private router: Router
  ) {}

  ngOnInit() {
    this.setViewMode(this.router.url);
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.setViewMode(event.urlAfterRedirects);
        this.refreshDisplayRows();
      });
    this.loadData();
  }

  loadData(refresher?: any) {
    if (!refresher) {
      this.isLoading = true;
    }
    this.hasError = false;
    this.dataService.getPackagingInventory().subscribe({
      next: (data) => {
        this.data = data;
        this.refreshDisplayRows();
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

  get pageTitle(): string {
    if (this.viewMode === 'rolls') {
      return 'Packaging Rolls Inventory';
    }

    if (this.viewMode === 'bags') {
      return 'Packaging Bags Inventory';
    }

    return this.data?.title ?? 'Packaging Inventory';
  }

  get pageDescription(): string {
    if (this.viewMode === 'rolls') {
      return 'Current stock levels for packaging roll materials only.';
    }

    if (this.viewMode === 'bags') {
      return 'Current stock levels for unpacked packaging bags only.';
    }

    return 'Current stock levels for roll and bag packaging materials across all zones.';
  }

  private setViewMode(url: string) {
    if (url.includes('packaging-rolls')) {
      this.viewMode = 'rolls';
      return;
    }

    if (url.includes('packaging-bags')) {
      this.viewMode = 'bags';
      return;
    }

    this.viewMode = 'all';
  }

  private refreshDisplayRows() {
    if (!this.data) {
      this.displayRows = [];
      return;
    }

    const rollRows = this.data.rolls.map((item) => ({ item, label: 'Roll' }));
    const bagRows = this.data.bags.map((item) => ({ item, label: 'Bag (unpacked)' }));

    if (this.viewMode === 'rolls') {
      this.displayRows = rollRows;
      return;
    }

    if (this.viewMode === 'bags') {
      this.displayRows = bagRows;
      return;
    }

    this.displayRows = [...rollRows, ...bagRows];
  }
}
