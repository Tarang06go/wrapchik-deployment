const selectPreviouslyOrderedProducts = (orderedProductIds, currentProducts) => {
  const byId = new Map((Array.isArray(currentProducts) ? currentProducts : [])
    .filter((product) => product?._id != null)
    .map((product) => [String(product._id), product]));
  const seen = new Set();
  return (Array.isArray(orderedProductIds) ? orderedProductIds : []).reduce((result, id) => {
    const key = String(id || '');
    if (!key || seen.has(key)) return result;
    seen.add(key);
    const product = byId.get(key);
    if (product) result.push(product);
    return result;
  }, []);
};

module.exports = { selectPreviouslyOrderedProducts };
