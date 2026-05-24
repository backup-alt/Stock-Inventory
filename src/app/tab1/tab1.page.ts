import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DataService } from '../core/services/data.service';
import { CalendarDay, DateFilterService } from '../core/services/date-filter.service';
import { CriticalStockItem, DashboardData, DatePeriod, InventoryBreakdownItem, KpiCard } from '../core/models/inventory.models';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page implements OnInit {
  data: DashboardData | null = null;
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
  private baseData: DashboardData | null = null;

  private readonly demoValues: Record<DatePeriod, {
    kpis: Array<string | number>;
    footers: string[];
    trends: string[];
    critical: number[];
    normal: number;
    breakdown: Array<string | number>;
    subtitle: string;
  }> = {
    daily: {
      kpis: ['300,000', 42, 18, 3],
      footers: ['300 metric tons raw stock'],
      trends: ['+2.4%'],
      critical: [91, 0],
      normal: 5400,
      breakdown: [300, '2.0k', '22.2k', '21.1k'],
      subtitle: 'Here is your warehouse status for today.'
    },
    weekly: {
      kpis: ['316,000', 268, 113, 12],
      footers: ['316 metric tons raw stock'],
      trends: ['+5.8%'],
      critical: [76, 4],
      normal: 6120,
      breakdown: [316, '13.7k', '19.4k', '18.2k'],
      subtitle: 'Here is your warehouse status for the last 7 days.'
    },
    monthly: {
      kpis: ['342,000', 1134, 486, 31],
      footers: ['342 metric tons raw stock'],
      trends: ['+11.2%'],
      critical: [58, 9],
      normal: 7380,
      breakdown: [342, '52.8k', '16.8k', '14.6k'],
      subtitle: 'Here is your warehouse status for this month.'
    }
  };

  constructor(
    private dataService: DataService,
    private dateFilter: DateFilterService,
    private router: Router
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
    this.dataService.getDashboard().subscribe({
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

    const demo = this.demoValues[this.activePeriod];
    const nextData = this.clone(this.baseData);
    nextData.subtitle = demo.subtitle;
    nextData.kpis.forEach((kpi, index) => {
      kpi.value = demo.kpis[index] ?? kpi.value;
      kpi.footer = demo.footers[index] ?? kpi.footer;
      if (kpi.trend && demo.trends[index]) {
        kpi.trend.percentage = demo.trends[index];
      }
    });
    nextData.criticalStock.forEach((item, index) => {
      item.quantity = demo.critical[index] ?? item.quantity;
    });
    if (nextData.normalStock[0]) {
      nextData.normalStock[0].quantity = demo.normal;
    }
    nextData.inventoryBreakdown.forEach((item, index) => {
      item.value = demo.breakdown[index] ?? item.value;
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

  private navigateTo(route: string) {
    this.router.navigate(['/tabs', route]);
  }

  private completeRefresh(refresher?: any) {
    refresher?.target?.complete();
  }

  private isNextMonthFuture(): boolean {
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + 1, 1);
    return nextMonth > currentMonth;
  }
}
