const normalizeName = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const inspectMenu = ({ products = [], categories = [], referenceItems = null, knownCategories = [] }) => {
  const categoryById = new Map(categories.map((category) => [String(category._id), category.name]));
  const findings = [];
  const names = new Map();
  for (const product of products) {
    const key = normalizeName(product.name);
    if (key) {
      const matches = names.get(key) || [];
      matches.push(product._id);
      names.set(key, matches);
    }
    if (!String(product.imageUrl || '').trim()) findings.push({ type: 'missing_image', product: product.name || String(product._id) });
    const categoryName = categoryById.get(String(product.categoryId?._id || product.categoryId));
    if (!categoryName) findings.push({ type: 'missing_category', product: product.name || String(product._id) });
    else if (knownCategories.length && !knownCategories.some((known) => normalizeName(known) === normalizeName(categoryName))) findings.push({ type: 'unknown_category', product: product.name || String(product._id), category: categoryName });
    const price = Number(product.price);
    if (!Number.isFinite(price) || price <= 0 || price > 1000) findings.push({ type: 'suspect_price', product: product.name || String(product._id), price: product.price });
  }
  for (const [name, ids] of names) if (ids.length > 1) findings.push({ type: 'duplicate_name', normalizedName: name, productIds: ids.map(String) });

  let reference = { available: Array.isArray(referenceItems), missingFromDatabase: [], priceDifferences: [] };
  if (Array.isArray(referenceItems)) {
    const databaseByName = new Map();
    for (const product of products) if (!databaseByName.has(normalizeName(product.name))) databaseByName.set(normalizeName(product.name), product);
    for (const item of referenceItems) {
      const actual = databaseByName.get(normalizeName(item.name));
      if (!actual) reference.missingFromDatabase.push(item.name);
      else if (Number.isFinite(Number(item.price)) && Number(item.price) !== Number(actual.price)) reference.priceDifferences.push({ name: item.name, referencePrice: item.price, databasePrice: actual.price });
    }
  }
  return { productCount: products.length, categoryCount: categories.length, reference, findings };
};

module.exports = { inspectMenu, normalizeName };
