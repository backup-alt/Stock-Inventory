import { DatePeriod } from '../models/inventory.models';
import { CalendarDay, DATE_PERIOD_OPTIONS, DateFilterService, DateRangeSelection } from './date-filter.service';

export abstract class DateRangePageBase {
  activePeriod: DatePeriod = 'weekly';
  readonly periodOptions = DATE_PERIOD_OPTIONS;
  currentDate = '';
  selectedDateIso = '';
  selectedRangeStartIso = '';
  selectedRangeEndIso = '';
  pendingRangeStartIso = '';
  pendingRangeEndIso = '';
  showCalendar = false;
  calendarMonth = new Date();
  calendarMonthLabel = '';
  calendarDays: CalendarDay[] = [];
  calendarNextDisabled = false;
  weekDayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  protected constructor(protected dateFilter: DateFilterService) {}

  setPeriod(period: string) {
    this.activePeriod = period as DatePeriod;
    this.dateFilter.setPeriod(this.activePeriod);
    this.setRangeFromPeriod();
    this.refreshCalendar();
    this.updateCurrentDate();
    this.onDateFilterChanged();
  }

  openCalendar() {
    this.showCalendar = !this.showCalendar;

    if (this.showCalendar) {
      this.pendingRangeStartIso = this.selectedRangeStartIso;
      this.pendingRangeEndIso = this.selectedRangeEndIso;
    }

    this.refreshCalendar();
  }

  selectDate(day: CalendarDay) {
    if (day.isFuture) {
      return;
    }

    this.calendarMonth = this.dateFilter.parseInputDate(day.iso);
    const startsNewRange = !this.pendingRangeStartIso || Boolean(this.pendingRangeEndIso);

    if (startsNewRange) {
      this.pendingRangeStartIso = day.iso;
      this.pendingRangeEndIso = '';
      this.refreshCalendar();
      return;
    }

    const range = this.normalizedRange(this.pendingRangeStartIso, day.iso);
    this.activePeriod = 'custom';
    this.selectedDateIso = range.endIso;
    this.selectedRangeStartIso = range.startIso;
    this.selectedRangeEndIso = range.endIso;
    this.pendingRangeStartIso = range.startIso;
    this.pendingRangeEndIso = range.endIso;
    this.showCalendar = false;
    this.refreshCalendar();
    this.updateCurrentDate();
    this.onDateFilterChanged();
  }

  moveCalendarMonth(offset: number) {
    if (offset > 0 && this.calendarNextDisabled) {
      return;
    }

    this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + offset, 1);
    this.refreshCalendar();
  }

  protected initializeDateFilter() {
    this.activePeriod = this.dateFilter.getCurrentPeriod();
    this.selectedDateIso = this.dateFilter.getInputDateValue();
    this.calendarMonth = this.dateFilter.parseInputDate(this.selectedDateIso);
    this.setRangeFromPeriod();
    this.refreshCalendar();
    this.updateCurrentDate();
  }

  protected dateQuery() {
    const isCustomRange = this.activePeriod === 'custom';
    const queryPeriod: DatePeriod = isCustomRange ? 'weekly' : this.activePeriod;
    const filter = this.dateFilter.buildFilter(queryPeriod, this.selectedDateIso, this.currentRange());

    return isCustomRange
      ? { ...filter, rangeType: 'custom' as const }
      : filter;
  }

  protected updateCurrentDate() {
    this.currentDate = this.dateFilter.getFormattedDate(this.activePeriod, this.selectedDateIso, this.currentRange());
  }

  protected refreshCalendar() {
    this.calendarMonthLabel = this.dateFilter.getMonthLabel(this.calendarMonth);
    this.calendarDays = this.dateFilter.getCalendarDays(
      this.calendarMonth,
      this.selectedDateIso,
      this.showCalendar ? this.pendingRange() : this.currentRange()
    );
    this.calendarNextDisabled = this.isNextMonthFuture();
  }

  protected abstract onDateFilterChanged(): void;

  private setRangeFromPeriod() {
    const range = this.dateFilter.getDateRange(this.activePeriod, this.selectedDateIso);
    this.selectedRangeStartIso = range.startIso;
    this.selectedRangeEndIso = range.endIso;
    this.pendingRangeStartIso = range.startIso;
    this.pendingRangeEndIso = range.endIso;
  }

  private currentRange(): DateRangeSelection {
    return {
      startIso: this.selectedRangeStartIso,
      endIso: this.selectedRangeEndIso,
    };
  }

  private pendingRange(): DateRangeSelection {
    return {
      startIso: this.pendingRangeStartIso,
      endIso: this.pendingRangeEndIso || this.pendingRangeStartIso,
    };
  }

  private normalizedRange(startIso: string, endIso: string): DateRangeSelection {
    if (endIso < startIso) {
      return { startIso: endIso, endIso: startIso };
    }

    return { startIso, endIso };
  }

  private isNextMonthFuture(): boolean {
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + 1, 1);
    return nextMonth > currentMonth;
  }
}
