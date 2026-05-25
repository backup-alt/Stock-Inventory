import { HttpError } from '../http/http-error.js';

const istOffsetMinutes = 330;
const allowedPeriods = new Set(['daily', 'weekly', 'monthly', 'custom']);
const periodMultipliers = {
  daily: 1,
  weekly: 1,
  monthly: 1,
  custom: 1,
};

export function parsePeriod(value) {
  const period = String(value || 'weekly').toLowerCase();

  if (!allowedPeriods.has(period)) {
    throw new HttpError(400, 'Unsupported period', { allowed: [...allowedPeriods] });
  }

  return period;
}

export function parseReportDate(value, now = new Date()) {
  if (!value) {
    return toIsoDateInIndia(now);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, 'Date must use YYYY-MM-DD format');
  }

  const requested = new Date(`${value}T00:00:00`);

  if (Number.isNaN(requested.getTime())) {
    throw new HttpError(400, 'Invalid date');
  }

  if (value > toIsoDateInIndia(now)) {
    throw new HttpError(422, 'Future dates are not available');
  }

  return value;
}

export function parseReportFilter(query = new URLSearchParams()) {
  const params = query || new URLSearchParams();
  const hasRange = params.has('fromDate') || params.has('toDate');

  if (hasRange) {
    const period = params.has('period') ? parsePeriod(params.get('period')) : 'custom';
    const fromDate = parseRangeDate(params.get('fromDate'), 'fromDate');
    const toDate = parseRangeDate(params.get('toDate'), 'toDate', { allowFuture: period !== 'custom' });

    if (fromDate > toDate) {
      throw new HttpError(400, 'fromDate must be before toDate');
    }

    return {
      period,
      date: toDate,
      fromDate,
      toDate,
      rangeType: params.get('rangeType') === 'custom' || period === 'custom' ? 'custom' : 'preset',
    };
  }

  return {
    period: parsePeriod(params.get('period')),
    date: parseReportDate(params.get('date')),
  };
}

export function currentReportFilter(period = 'weekly', now = new Date()) {
  return {
    period: parsePeriod(period),
    date: toIsoDateInIndia(now),
  };
}

export function dateRangeForFilter(filter = currentReportFilter()) {
  if (filter.fromDate && filter.toDate) {
    const startParts = datePartsFromIso(filter.fromDate);
    const endDate = datePartsFromIso(filter.toDate);
    const endParts = partsFromUtcDate(new Date(Date.UTC(endDate.year, endDate.monthIndex, endDate.day + 1)));
    const start = indiaLocalToUtc(startParts.year, startParts.monthIndex, startParts.day);
    const end = indiaLocalToUtc(endParts.year, endParts.monthIndex, endParts.day);
    const toDate = new Date(end.getTime() - 1000);

    return {
      start,
      end,
      fromDate: start.toISOString(),
      toDate: toDate.toISOString(),
    };
  }

  const selected = datePartsFromIso(filter.date);
  const endParts = endExclusivePartsForFilter(filter.period, selected);
  const startParts = startPartsForFilter(filter.period, selected);
  const start = indiaLocalToUtc(startParts.year, startParts.monthIndex, startParts.day);
  const end = indiaLocalToUtc(endParts.year, endParts.monthIndex, endParts.day);
  const toDate = new Date(end.getTime() - 1000);

  return {
    start,
    end,
    fromDate: start.toISOString(),
    toDate: toDate.toISOString(),
  };
}

export function scaleForPeriod(value, period) {
  const numericValue = Number(String(value).replace(/,/g, ''));

  if (!Number.isFinite(numericValue)) {
    return value;
  }

  const nextValue = Math.round(numericValue * periodMultipliers[period]);
  return nextValue.toLocaleString('en-US');
}

export function labelsForPeriod(period) {
  if (period === 'weekly') {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  }

  if (period === 'monthly') {
    return ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
  }

  return ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
}

export function dataForPeriod(values, period) {
  return labelsForPeriod(period).map((_, index) => Math.round(numberOrZero(values[index])));
}

function parseRangeDate(value, field, options = {}, now = new Date()) {
  if (!value) {
    throw new HttpError(400, `${field} is required`);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const requested = new Date(`${value}T00:00:00`);

    if (Number.isNaN(requested.getTime())) {
      throw new HttpError(400, 'Invalid date');
    }

    if (!options.allowFuture && value > toIsoDateInIndia(now)) {
      throw new HttpError(422, 'Future dates are not available');
    }

    return value;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, `${field} must use YYYY-MM-DD or ISO date format`);
  }

  const isoDate = toIsoDateInIndia(parsed);

  if (!options.allowFuture && isoDate > toIsoDateInIndia(now)) {
    throw new HttpError(422, 'Future dates are not available');
  }

  return isoDate;
}

function startPartsForFilter(period, selected) {
  if (period === 'monthly') {
    return { year: selected.year, monthIndex: selected.monthIndex, day: 1 };
  }

  if (period === 'weekly') {
    const selectedUtc = new Date(Date.UTC(selected.year, selected.monthIndex, selected.day));
    const mondayOffset = (selectedUtc.getUTCDay() + 6) % 7;
    return partsFromUtcDate(new Date(Date.UTC(selected.year, selected.monthIndex, selected.day - mondayOffset)));
  }

  return selected;
}

function endExclusivePartsForFilter(period, selected) {
  if (period === 'monthly') {
    return { year: selected.year, monthIndex: selected.monthIndex + 1, day: 1 };
  }

  if (period === 'weekly') {
    const start = startPartsForFilter(period, selected);
    return partsFromUtcDate(new Date(Date.UTC(start.year, start.monthIndex, start.day + 7)));
  }

  return partsFromUtcDate(new Date(Date.UTC(selected.year, selected.monthIndex, selected.day + 1)));
}

function datePartsFromIso(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return { year, monthIndex: (month || 1) - 1, day: day || 1 };
}

function partsFromUtcDate(date) {
  return {
    year: date.getUTCFullYear(),
    monthIndex: date.getUTCMonth(),
    day: date.getUTCDate(),
  };
}

function indiaLocalToUtc(year, monthIndex, day) {
  return new Date(Date.UTC(year, monthIndex, day, 0, -istOffsetMinutes, 0, 0));
}

function toIsoDateInIndia(date) {
  const indiaDate = new Date(date.getTime() + istOffsetMinutes * 60_000);
  const year = indiaDate.getUTCFullYear();
  const month = `${indiaDate.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${indiaDate.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function numberOrZero(value) {
  const number = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(number) ? number : 0;
}
