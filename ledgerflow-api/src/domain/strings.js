export function cleanText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function shortUnit(value) {
  const unit = cleanText(value);
  const normalized = unit.toLowerCase();

  if (normalized === 'kilogram' || normalized === 'kilograms') {
    return 'kg';
  }

  if (normalized === 'metric ton' || normalized === 'metric tons') {
    return 'MT';
  }

  return unit;
}

export function numberOrZero(value) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

export function titleFromSlug(slug) {
  return String(slug)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
