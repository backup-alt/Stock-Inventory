export function stockStatus(quantity) {
  const value = Number(quantity);

  if (!Number.isFinite(value) || value <= 0) {
    return 'out-of-stock';
  }

  if (value <= 100) {
    return 'low-stock';
  }

  return 'in-stock';
}

export function statusColor(status) {
  if (status === 'out-of-stock' || status === 'critical') {
    return 'red';
  }

  if (status === 'low-stock' || status === 'low') {
    return 'yellow';
  }

  return 'green';
}
