import { Component, OnInit } from '@angular/core';
import { DataService } from '../../core/services/data.service';
import { DateFilterService } from '../../core/services/date-filter.service';
import { DatePeriod, InventoryTableData } from '../../core/models/inventory.models';

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
    if (!refresher) {
      return;
    }

    setTimeout(() => refresher.target?.complete(), 500);
  }
}
