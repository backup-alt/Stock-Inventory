import { Component, OnInit } from '@angular/core';
import { DataService } from '../../core/services/data.service';
import { InventoryTableData } from '../../core/models/inventory.models';

@Component({
  selector: 'app-inventory-crystalline',
  templateUrl: './inventory-crystalline.page.html',
  styleUrls: ['./inventory-crystalline.page.scss'],
  standalone: false,
})
export class InventoryCrystallinePage implements OnInit {
  data: InventoryTableData | null = null;
  isLoading = true;
  hasError = false;

  constructor(private dataService: DataService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData(refresher?: any) {
    if (!refresher) {
      this.isLoading = true;
    }
    this.hasError = false;
    this.dataService.getCrystallineInventory().subscribe({
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
    refresher?.target?.complete();
  }
}
