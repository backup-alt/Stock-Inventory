import { Component, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { DataService } from '../../core/services/data.service';
import { CalendarDay, DateFilterService } from '../../core/services/date-filter.service';
import { DatePeriod, InventoryTableItem, PackagingInventoryData } from '../../core/models/inventory.models';
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
  activePeriod: DatePeriod = 'daily';
  currentDate = '';
  selectedDateIso = '';
  showCalendar = false;
  calendarMonth = new Date();
  calendarMonthLabel = '';
  calendarDays: CalendarDay[] = [];
  calendarNextDisabled = false;
  weekDayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  constructor(
    private dataService: DataService,
    private router: Router,
    private dateFilter: DateFilterService
  ) {}

  ngOnInit() {
    this.activePeriod = this.dateFilter.getCurrentPeriod();
    this.selectedDateIso = this.dateFilter.getInputDateValue();
    this.calendarMonth = this.dateFilter.parseInputDate(this.selectedDateIso);
    this.refreshCalendar();
    this.currentDate = this.dateFilter.getFormattedDate(this.activePeriod, this.selectedDateIso);
    this.setViewMode(this.router.url);
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.setViewMode(event.urlAfterRedirects);
        this.refreshDisplayRows();
      });
    this.loadData();
  }

  setPeriod(period: string) {
    this.activePeriod = period as DatePeriod;
    this.dateFilter.setPeriod(this.activePeriod);
    this.currentDate = this.dateFilter.getFormattedDate(this.activePeriod, this.selectedDateIso);
    this.loadData();
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
    this.currentDate = this.dateFilter.getFormattedDate(this.activePeriod, this.selectedDateIso);
    this.loadData();
  }

  moveCalendarMonth(offset: number) {
    if (offset > 0 && this.calendarNextDisabled) {
      return;
    }

    this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + offset, 1);
    this.refreshCalendar();
  }

  loadData(refresher?: any) {
    if (!refresher) {
      this.isLoading = true;
    }
    this.hasError = false;
    this.dataService.getPackagingInventory(this.dateQuery()).subscribe({
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

  private dateQuery() {
    return { period: this.activePeriod, date: this.selectedDateIso };
  }

  private refreshCalendar() {
    this.calendarMonthLabel = this.dateFilter.getMonthLabel(this.calendarMonth);
    this.calendarDays = this.dateFilter.getCalendarDays(this.calendarMonth, this.selectedDateIso);
    this.calendarNextDisabled = this.isNextMonthFuture();
  }

  private isNextMonthFuture(): boolean {
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + 1, 1);
    return nextMonth > currentMonth;
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
