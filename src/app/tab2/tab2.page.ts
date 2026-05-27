import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DataService } from '../core/services/data.service';
import { DateFilterService } from '../core/services/date-filter.service';
import { DateRangePageBase } from '../core/services/date-range-page-base';
import { OverallReportData, AnalyticsData } from '../core/models/inventory.models';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page extends DateRangePageBase implements OnInit {
  data: OverallReportData | null = null;
  isLoading = true;
  hasError = false;
  analyticsCharts: AnalyticsData[] = [];
  private baseData: OverallReportData | null = null;

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
    this.dataService.getOverallReport(this.dateQuery()).subscribe({
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

  barHeight(value: number, chart: AnalyticsData): number {
    const values = chart.data.map((item) => Number(item) || 0);
    const max = Math.max(...values, 0);

    if (max <= 0) {
      return 2;
    }

    const normalized = ((Number(value) || 0) / max) * 100;
    return Math.max(6, Math.min(100, normalized));
  }

  openProductionDetails() {
    this.router.navigate(['/tabs/production-log']);
  }

  private applyDemoPeriod() {
    if (!this.baseData) {
      return;
    }

    const nextData = this.clone(this.baseData);
    this.updateCurrentDate();
    this.data = nextData;
    this.analyticsCharts = [nextData.analytics.bundlesPacked];
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
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
