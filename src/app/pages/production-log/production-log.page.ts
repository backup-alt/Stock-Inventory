import { Component, OnInit } from '@angular/core';
import { DataService } from '../../core/services/data.service';
import { DateFilterService } from '../../core/services/date-filter.service';
import { DateRangePageBase } from '../../core/services/date-range-page-base';
import { InventoryTableData } from '../../core/models/inventory.models';

@Component({
  selector: 'app-production-log',
  templateUrl: './production-log.page.html',
  styleUrls: ['./production-log.page.scss'],
  standalone: false,
})
export class ProductionLogPage extends DateRangePageBase implements OnInit {
  data: InventoryTableData | null = null;
  isLoading = true;
  hasError = false;

  constructor(
    private dataService: DataService,
    dateFilter: DateFilterService
  ) {
    super(dateFilter);
  }

  ngOnInit() {
    this.dateFilter.setPeriod('monthly');
    this.initializeDateFilter();
    this.loadData();
  }

  loadData(refresher?: any) {
    if (!refresher && !this.data) {
      this.isLoading = true;
    }
    this.hasError = false;
    this.dataService.getProductionLog(this.dateQuery()).subscribe({
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

  protected onDateFilterChanged(): void {
    this.loadData();
  }
}
