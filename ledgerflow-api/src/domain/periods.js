import { HttpError } from '../http/http-error.js';

const allowedPeriods = new Set(['daily', 'weekly', 'monthly']);
const periodMultipliers = {
  daily: 1,
  weekly: 5.8,
  monthly: 23.5,
};

export function parsePeriod(value) {
  const period = String(value || 'daily').toLowerCase();

  if (!allowedPeriods.has(period)) {
    throw new HttpError(400, 'Unsupported period', { allowed: [...allowedPeriods] });
  }

  return period;
}

export function parseReportDate(value, now = new Date()) {
  if (!value) {
    return toIsoDate(now);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, 'Date must use YYYY-MM-DD format');
  }

  const requested = new Date(`${value}T00:00:00`);

  if (Number.isNaN(requested.getTime())) {
    throw new HttpError(400, 'Invalid date');
  }

  if (value > toIsoDate(now)) {
    throw new HttpError(422, 'Future dates are not available');
  }

  return value;
}

export function parseReportFilter(query) {
  return {
    period: parsePeriod(query.get('period')),
    date: parseReportDate(query.get('date')),
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
    return ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  }

  return ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
}

export function dataForPeriod(values, period) {
  if (period === 'weekly') {
    return [0.74, 0.86, 0.93, 0.88, 1.04, 1.1, 0.96].map((factor, index) => {
      const base = values[index % values.length] || 0;
      return Math.round(base * factor);
    });
  }

  if (period === 'monthly') {
    return [4.2, 5.1, 4.8, 5.4].map((factor, index) => {
      const base = values[index % values.length] || 0;
      return Math.round(base * factor);
    });
  }

  return values;
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
