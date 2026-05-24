import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DatePeriod } from '../models/inventory.models';

export interface CalendarDay {
  iso: string;
  label: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isFuture: boolean;
}

@Injectable({ providedIn: 'root' })
export class DateFilterService {
  private periodSubject = new BehaviorSubject<DatePeriod>('daily');
  period$ = this.periodSubject.asObservable();

  setPeriod(period: DatePeriod) {
    this.periodSubject.next(period);
  }

  getCurrentPeriod(): DatePeriod {
    return this.periodSubject.value;
  }

  getFormattedDate(period: DatePeriod = this.getCurrentPeriod(), date: string | Date = new Date()): string {
    const today = typeof date === 'string' ? this.parseInputDate(date) : date;

    if (period === 'weekly') {
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      const shortDate: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      return `This week: ${start.toLocaleDateString('en-US', shortDate)} - ${today.toLocaleDateString('en-US', shortDate)}`;
    }

    if (period === 'monthly') {
      return today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    return today.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
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

  getCalendarDays(monthDate: Date, selectedDateIso: string): CalendarDay[] {
    const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const start = new Date(firstOfMonth);
    start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
    const todayIso = this.getInputDateValue();

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const iso = this.getInputDateValue(date);

      return {
        iso,
        label: date.getDate(),
        isCurrentMonth: date.getMonth() === monthDate.getMonth(),
        isToday: iso === todayIso,
        isSelected: iso === selectedDateIso,
        isFuture: iso > todayIso
      };
    });
  }

  parseInputDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  }
}
