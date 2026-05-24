import { Component, OnInit } from '@angular/core';
import { DataService } from '../../core/services/data.service';
import { InventoryTableData } from '../../core/models/inventory.models';

@Component({
  selector: 'app-inventory-raw-salt',
  templateUrl: './inventory-raw-salt.page.html',
  styleUrls: ['./inventory-raw-salt.page.scss'],
  standalone: false,
})
export class InventoryRawSaltPage implements OnInit {
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
    this.dataService.getRawSaltInventory().subscribe({
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

  private completeRefresh(refresher?: any) {
    refresher?.target?.complete();
  }
}
