const ORDER_FILTERS = new Set(['ALL', 'ACTIVE', 'COMPLETED']);

export function orderFilterFromParam(value) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = String(candidate || '').trim().toUpperCase();
  return ORDER_FILTERS.has(normalized) ? normalized : 'ALL';
}
