export const isProductAvailable = (product) => {
  if (!product || product.available === false) return false;
  // null/undefined means unlimited stock. Do not coerce null to zero here.
  if (product.stock === null || product.stock === undefined || product.stock === '') return true;
  const stock = Number(product.stock);
  return !Number.isFinite(stock) || stock > 0;
};
