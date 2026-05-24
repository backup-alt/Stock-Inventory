export function rawSaltStock(source) {
  const rawStock = source?.data?.rawSaltStock;

  if (Array.isArray(rawStock)) {
    return rawStock[0] || {};
  }

  return rawStock || {};
}
