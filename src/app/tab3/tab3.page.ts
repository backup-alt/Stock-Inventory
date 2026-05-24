import { Component, OnInit } from '@angular/core';
import { DataService } from '../core/services/data.service';
import { CalendarDay, DateFilterService } from '../core/services/date-filter.service';
import { StockReportData, DatePeriod } from '../core/models/inventory.models';

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
  activePeriod: DatePeriod = 'daily';
  currentDate = '';
  selectedDateIso = '';
  showCalendar = false;
  calendarMonth = new Date();
  calendarMonthLabel = '';
  calendarDays: CalendarDay[] = [];
  calendarNextDisabled = false;
  weekDayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  private baseData: StockReportData | null = null;

  private readonly demoValues: Record<DatePeriod, Array<{
    value: string | number;
    trendText: string;
    direction: 'up' | 'down' | 'flat';
    status: 'green' | 'yellow' | 'red';
  }>> = {
    daily: [
      { value: 300, trendText: '+2% from yesterday', direction: 'up', status: 'green' },
      { value: '1,930', trendText: '+5% from yesterday', direction: 'up', status: 'green' },
      { value: '12,450', trendText: '-3% from yesterday', direction: 'down', status: 'yellow' }
    ],
    weekly: [
      { value: 316, trendText: '+6% from last week', direction: 'up', status: 'green' },
      { value: '13,720', trendText: '+11% from last week', direction: 'up', status: 'green' },
      { value: '19,400', trendText: '-15% from last week', direction: 'down', status: 'yellow' }
    ],
    monthly: [
      { value: 342, trendText: '+14% from last month', direction: 'up', status: 'green' },
      { value: '52,880', trendText: '+18% from last month', direction: 'up', status: 'green' },
      { value: '74,600', trendText: '-8% from last month', direction: 'down', status: 'yellow' }
    ]
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
    this.dataService.getStockReport().subscribe({
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

    const nextData = this.clone(this.baseData);
    const demo = this.demoValues[this.activePeriod];
    nextData.cards.forEach((card, index) => {
      const cardDemo = demo[index];
      if (!cardDemo) {
        return;
      }

      card.value = cardDemo.value;
      card.status = cardDemo.status;
      card.trend.direction = cardDemo.direction;
      card.trend.text = cardDemo.trendText;
    });

    this.currentDate = this.dateFilter.getFormattedDate(this.activePeriod, this.selectedDateIso);
    this.data = nextData;
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
