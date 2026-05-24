import { Component, OnInit } from '@angular/core';
import { DataService } from '../core/services/data.service';
import { CalendarDay, DateFilterService } from '../core/services/date-filter.service';
import { OverallReportData, AnalyticsData, DatePeriod } from '../core/models/inventory.models';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page implements OnInit {
  data: OverallReportData | null = null;
  isLoading = true;
  hasError = false;
  activePeriod: DatePeriod = 'daily';
  currentDate = '';
  analyticsCharts: AnalyticsData[] = [];
  selectedDateIso = '';
  showCalendar = false;
  calendarMonth = new Date();
  calendarMonthLabel = '';
  calendarDays: CalendarDay[] = [];
  calendarNextDisabled = false;
  weekDayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  private baseData: OverallReportData | null = null;

  private readonly demoValues: Record<DatePeriod, {
    kpis: Array<string | number>;
    targetLabel: string;
    targetPercentage: number;
    progressLabel: string;
    progressPercentage: number;
    chartData: number[];
    chartLabels: string[];
  }> = {
    daily: {
      kpis: ['1,248', '8,420', 342, 86],
      targetLabel: "Today's Target: 1,500",
      targetPercentage: 83,
      progressLabel: 'Daily allowance',
      progressPercentage: 65,
      chartData: [40, 60, 50, 80, 100, 70],
      chartLabels: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00']
    },
    weekly: {
      kpis: ['8,736', '52,600', 1884, 432],
      targetLabel: 'Weekly Target: 10,500',
      targetPercentage: 83,
      progressLabel: 'Weekly allowance',
      progressPercentage: 72,
      chartData: [52, 66, 59, 88, 76, 94, 71],
      chartLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    },
    monthly: {
      kpis: ['37,420', '218,900', 7420, 1825],
      targetLabel: 'Monthly Target: 42,000',
      targetPercentage: 89,
      progressLabel: 'Monthly allowance',
      progressPercentage: 81,
      chartData: [46, 62, 71, 85],
      chartLabels: ['W1', 'W2', 'W3', 'W4']
    }
  };

  constructor(
    private dataService: DataService,
    private dateFilter: DateFilterService
  ) {}

  ngOnInit() {
    this.activePeriod = this.dateFilter.getCurrentPeriod();
    this.selectedDateIso = this.dateFilter.getInputDateValue();
    this.calendarMonth = this.dateFilter.parseInputDate(this.selectedDateIso);
    this.refreshCalendar();
    this.currentDate = this.dateFilter.getFormattedDate(this.activePeriod, this.selectedDateIso);
    this.loadData();
  }

  loadData(refresher?: any) {
    if (!refresher) {
      this.isLoading = true;
    }
    this.hasError = false;
    this.dataService.getOverallReport().subscribe({
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

  setPeriod(period: string) {
    this.activePeriod = period as DatePeriod;
    this.dateFilter.setPeriod(this.activePeriod);
    this.applyDemoPeriod();
  }

  openCalendar() {
    this.showCalendar = !this.showCalendar;
  }

  selectDate(day: CalendarDay) {
    if (day.isFuture) {
      return;
    }

    this.selectedDateIso = day.iso;
    this.calendarMonth = this.dateFilter.parseInputDate(day.iso);
    this.showCalendar = false;
    this.refreshCalendar();
    this.applyDemoPeriod();
  }

  moveCalendarMonth(offset: number) {
    if (offset > 0 && this.calendarNextDisabled) {
      return;
    }

    this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + offset, 1);
    this.refreshCalendar();
  }

  private applyDemoPeriod() {
    if (!this.baseData) {
      return;
    }

    const demo = this.demoValues[this.activePeriod];
    const nextData = this.clone(this.baseData);
    nextData.kpis.forEach((kpi, index) => {
      kpi.value = demo.kpis[index] ?? kpi.value;
    });
    if (nextData.kpis[0].target) {
      nextData.kpis[0].target.label = demo.targetLabel;
      nextData.kpis[0].target.percentage = demo.targetPercentage;
    }
    if (nextData.kpis[1].progress) {
      nextData.kpis[1].progress.label = demo.progressLabel;
      nextData.kpis[1].progress.percentage = demo.progressPercentage;
    }
    nextData.analytics.bundlesPacked.data = demo.chartData;
    nextData.analytics.bundlesPacked.labels = demo.chartLabels;

    this.currentDate = this.dateFilter.getFormattedDate(this.activePeriod, this.selectedDateIso);
    this.data = nextData;
    this.analyticsCharts = [nextData.analytics.bundlesPacked];
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private refreshCalendar() {
    this.calendarMonthLabel = this.dateFilter.getMonthLabel(this.calendarMonth);
    this.calendarDays = this.dateFilter.getCalendarDays(this.calendarMonth, this.selectedDateIso);
    this.calendarNextDisabled = this.isNextMonthFuture();
  }

  private completeRefresh(refresher?: any) {
    if (!refresher) {
      return;
    }

    setTimeout(() => refresher.target?.complete(), 500);
  }

  private isNextMonthFuture(): boolean {
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + 1, 1);
    return nextMonth > currentMonth;
  }
}
