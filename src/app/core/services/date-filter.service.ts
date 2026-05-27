import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DatePeriod } from '../models/inventory.models';

export interface CalendarDay {
  iso: string;
  label: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  isInRange: boolean;
  isFuture: boolean;
}

export interface DatePeriodOption {
  label: string;
  value: DatePeriod;
}

export interface DateRangeSelection {
  startIso: string;
  endIso: string;
}

export interface ResolvedDateFilter {
  period: DatePeriod;
  date: string;
  fromDate: string;
  toDate: string;
  rangeType?: 'custom';
}

export const DATE_PERIOD_OPTIONS: DatePeriodOption[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
];

@Injectable({ providedIn: 'root' })
export class DateFilterService {
  readonly periodOptions = DATE_PERIOD_OPTIONS;
  private readonly istOffsetMinutes = 330;

  private periodSubject = new BehaviorSubject<DatePeriod>('daily');
  period$ = this.periodSubject.asObservable();

  setPeriod(period: DatePeriod) {
    this.periodSubject.next(period);
  }

  getCurrentPeriod(): DatePeriod {
    return this.periodSubject.value;
  }

  getFormattedDate(
    period: DatePeriod = this.getCurrentPeriod(),
    date: string | Date = new Date(),
    range?: DateRangeSelection
  ): string {
    const today = typeof date === 'string' ? this.parseInputDate(date) : date;
    const selectedRange = range ?? this.getDateRange(period, this.getInputDateValue(today));
    const shortDate: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

    if (period === 'custom') {
      const start = this.parseInputDate(selectedRange.startIso);
      const end = this.parseInputDate(selectedRange.endIso);
      const endOptions: Intl.DateTimeFormatOptions = start.getFullYear() === end.getFullYear()
        ? shortDate
        : { month: 'short', day: 'numeric', year: 'numeric' };

      if (selectedRange.startIso === selectedRange.endIso) {
        return start.toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
      }

      return `Selected range: ${start.toLocaleDateString('en-US', shortDate)} - ${end.toLocaleDateString('en-US', endOptions)}`;
    }

    if (period === 'weekly') {
      const start = this.parseInputDate(selectedRange.startIso);
      const end = this.parseInputDate(selectedRange.endIso);
      return `Current week: ${start.toLocaleDateString('en-US', shortDate)} - ${end.toLocaleDateString('en-US', shortDate)}`;
    }

    if (period === 'monthly') {
      return today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    return today.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  buildFilter(
    period: DatePeriod = this.getCurrentPeriod(),
    date: string = this.getInputDateValue(),
    range?: DateRangeSelection
  ): ResolvedDateFilter {
    const selectedRange = range?.startIso && range?.endIso
      ? this.normalizeRange(range.startIso, range.endIso)
      : this.getDateRange(period, date);
    const todayIso = this.getInputDateValue();
    const rangeIncludesToday = selectedRange.startIso <= todayIso && selectedRange.endIso >= todayIso;

    return {
      period,
      date,
      fromDate: this.toApiFromDate(selectedRange.startIso),
      toDate: rangeIncludesToday ? new Date().toISOString() : this.toApiToDate(selectedRange.endIso),
    };
  }

  getDateRange(period: DatePeriod, date: string = this.getInputDateValue()): DateRangeSelection {
    const selected = this.parseInputDate(date);

    if (period === 'weekly') {
      const start = this.startOfWeek(selected);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return {
        startIso: this.getInputDateValue(start),
        endIso: this.getInputDateValue(end),
      };
    }

    if (period === 'monthly') {
      const start = new Date(selected.getFullYear(), selected.getMonth(), 1);
      const end = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
      return {
        startIso: this.getInputDateValue(start),
        endIso: this.getInputDateValue(end),
      };
    }

    return { startIso: date, endIso: date };
  }

  getInputDateValue(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getMonthLabel(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  getCalendarDays(monthDate: Date, selectedDateIso: string, range?: DateRangeSelection): CalendarDay[] {
    const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const start = new Date(firstOfMonth);
    start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
    const todayIso = this.getInputDateValue();
    const selectedRange = range?.startIso
      ? this.normalizeRange(range.startIso, range.endIso || range.startIso)
      : null;

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const iso = this.getInputDateValue(date);
      const isInRange = selectedRange ? iso >= selectedRange.startIso && iso <= selectedRange.endIso : false;

      return {
        iso,
        label: date.getDate(),
        isCurrentMonth: date.getMonth() === monthDate.getMonth(),
        isToday: iso === todayIso,
        isSelected: isInRange || iso === selectedDateIso,
        isRangeStart: Boolean(selectedRange && iso === selectedRange.startIso),
        isRangeEnd: Boolean(selectedRange && iso === selectedRange.endIso),
        isInRange,
        isFuture: iso > todayIso
      };
    });
  }

  parseInputDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  }

  private startOfWeek(date: Date): Date {
    const start = new Date(date);
    const mondayOffset = (date.getDay() + 6) % 7;
    start.setDate(date.getDate() - mondayOffset);
    return start;
  }

  private normalizeRange(startIso: string, endIso: string): DateRangeSelection {
    if (endIso < startIso) {
      return { startIso: endIso, endIso: startIso };
    }

    return { startIso, endIso };
  }

  private toApiFromDate(value: string): string {
    const { year, monthIndex, day } = this.dateParts(value);
    return new Date(Date.UTC(year, monthIndex, day, 0, -this.istOffsetMinutes, 0, 0)).toISOString();
  }

  private toApiToDate(value: string): string {
    const { year, monthIndex, day } = this.dateParts(value);
    const nextDayStart = new Date(Date.UTC(year, monthIndex, day + 1, 0, -this.istOffsetMinutes, 0, 0));
    return new Date(nextDayStart.getTime() - 1000).toISOString();
  }

  private dateParts(value: string) {
    const [year, month, day] = value.split('-').map(Number);
    return { year, monthIndex: (month || 1) - 1, day: day || 1 };
  }
}
