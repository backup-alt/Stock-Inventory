import { Component, OnInit } from '@angular/core';
import { DataService } from '../core/services/data.service';
import { DateFilterService } from '../core/services/date-filter.service';
import { StockReportData } from '../core/models/inventory.models';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page implements OnInit {
  data: StockReportData | null = null;
  isLoading = true;
  hasError = false;
  currentDate = '';

  constructor(
    private dataService: DataService,
    private dateFilter: DateFilterService
  ) {}

  ngOnInit() {
    this.updateCurrentDate();
    this.loadData();
  }

  loadData(refresher?: any) {
    if (!refresher && !this.data) {
      this.isLoading = true;
    }
    this.hasError = false;
    this.dataService.getStockReport(this.currentStockQuery()).subscribe({
      next: (data) => {
        this.data = data;
        this.updateCurrentDate();
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

  private updateCurrentDate() {
    this.currentDate = `Current stock snapshot - ${new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })}`;
  }

  private currentStockQuery() {
    const today = this.dateFilter.getInputDateValue();
    return this.dateFilter.buildFilter('daily', today);
  }
}
