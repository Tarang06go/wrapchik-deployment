const PRICE_BOUNDS = {
  ALL: [null, null],
  UNDER_100: [null, 99],
  '100_200': [100, 200],
  OVER_200: [200, null],
};

export const filterCatalogueProducts = (products, {
  search = '', category = null, diet = 'ALL', priceRange = 'ALL', sort = { field: 'createdAt', order: 'desc' },
} = {}) => {
  const term = String(search || '').trim().toLocaleLowerCase();
  const [minimum, maximum] = PRICE_BOUNDS[priceRange] || PRICE_BOUNDS.ALL;
  const filtered = (Array.isArray(products) ? products : []).filter(product => {
    if (term && !String(product?.name || '').toLocaleLowerCase().includes(term)) return false;
    const categoryId = product?.categoryId?._id || product?.categoryId || product?.category?._id || product?.category;
    if (category && String(categoryId || '') !== String(category)) return false;
    if (diet === 'VEG' && product?.isVeg !== true) return false;
    if (diet === 'NON_VEG' && product?.isVeg !== false) return false;
    const price = Number(product?.price);
    if (!Number.isFinite(price) || (minimum != null && price < minimum) || (maximum != null && price > maximum)) return false;
    return true;
  });
  // `sort: null` is used for keystroke filtering over a list that is already
  // ordered by the selected non-text filters. Avoid an O(n log n) sort per key.
  if (sort === null) return filtered;
  const direction = sort?.order === 'asc' ? 1 : -1;
  const field = sort?.field || 'createdAt';
  return filtered.sort((left, right) => {
    if (field === 'price') return (Number(left.price) - Number(right.price)) * direction;
    if (field === 'name') return String(left.name || '').localeCompare(String(right.name || ''), 'en', { sensitivity: 'base' }) * direction;
    return (new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime()) * direction;
  });
};
