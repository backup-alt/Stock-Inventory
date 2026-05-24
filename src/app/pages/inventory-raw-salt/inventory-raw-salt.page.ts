import { Component, OnInit } from '@angular/core';
import { DataService } from '../../core/services/data.service';
import { CalendarDay, DateFilterService } from '../../core/services/date-filter.service';
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
  selectedDateIso = '';
  showCalendar = false;
  calendarMonth = new Date();
  calendarMonthLabel = '';
  calendarDays: CalendarDay[] = [];
  calendarNextDisabled = false;
  weekDayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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
    this.dataService.getRawSaltInventory(this.dateQuery()).subscribe({
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
}
