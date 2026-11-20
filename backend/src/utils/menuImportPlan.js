const normalizeMenuName = value => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const classifyFromExplicitName = name => {
  const normalized = normalizeMenuName(name);
  if (/\bchicken\b/.test(normalized)) return false;
  if (/\bveg\b|\bpaneer\b|\bcottage cheese\b|\baloo tikki\b|\bvada pav\b/.test(normalized)) return true;
  return null;
};

const buildImageUrl = source => `https://images.unsplash.com/${source.photoId}?auto=format&fit=crop&crop=entropy&w=1200&h=1200&q=84`;

function planMenuImport({ manifest, imageSources, existingProducts, existingCategories }) {
  const categoryByKey = new Map();
  for (const category of existingCategories) {
    const key = normalizeMenuName(category.name);
    if (categoryByKey.has(key)) throw new Error(`Existing duplicate category name after normalization: ${category.name}`);
    categoryByKey.set(key, category);
  }

  const requestedCategories = new Map();
  for (const item of manifest.categories || []) {
    const key = normalizeMenuName(item.name);
    if (requestedCategories.has(key)) throw new Error(`Manifest repeats category ${item.name}.`);
    if (!item.imageKey || !imageSources[item.imageKey]) throw new Error(`Category ${item.name} has no validated image source.`);
    requestedCategories.set(key, item);
  }

  const rows = manifest.products || [];
  const incomingKeys = new Set();
  for (const row of rows.filter(item => item.status !== 'needs_review')) {
    if (!row.name?.trim() || !Number.isFinite(row.price) || row.price < 0 || !row.category) throw new Error('Every confirmed menu row needs an exact name, non-negative price, and category.');
    const key = `${normalizeMenuName(row.category)}|${normalizeMenuName(row.name)}`;
    if (incomingKeys.has(key)) throw new Error(`Manifest contains a duplicate product: ${row.name} (${row.category}).`);
    incomingKeys.add(key);
    if (!row.imageKey && row.imageReviewRequired !== true) throw new Error(`${row.name} has no photo source and is not marked for manual image review.`);
    if (row.imageKey && !imageSources[row.imageKey]) throw new Error(`${row.name} refers to an unknown photo source.`);
  }

  const missingCategories = [];
  for (const category of requestedCategories.values()) {
    if (!categoryByKey.has(normalizeMenuName(category.name))) missingCategories.push(category);
  }

  const existingByName = existingProducts.map(product => ({
    product,
    nameKey: normalizeMenuName(product.name),
    categoryKey: normalizeMenuName(product.categoryName || ''),
  }));
  const creates = [];
  const updates = [];
  const reviewItems = [];
  const warnings = [];

  for (const row of rows) {
    if (row.status === 'needs_review') {
      reviewItems.push({ name: row.name, price: row.price, category: row.category, note: row.reviewNote || 'Confirm the screenshot text before import.' });
      continue;
    }
    const categoryKey = normalizeMenuName(row.category);
    const category = categoryByKey.get(categoryKey) || requestedCategories.get(categoryKey);
    if (!category) throw new Error(`Unknown category ${row.category} for ${row.name}.`);
    const names = [row.name, ...(row.aliases || [])].map(normalizeMenuName);
    const matches = existingByName.filter(entry => entry.categoryKey === categoryKey && names.includes(entry.nameKey));
    if (matches.length > 1) throw new Error(`More than one existing product matches ${row.name}; refusing to choose automatically.`);
    if (!matches.length) {
      const crossCategory = existingByName.find(entry => names.includes(entry.nameKey));
      if (crossCategory) throw new Error(`${row.name} resembles existing ${crossCategory.product.name} in ${crossCategory.product.categoryName}; refusing to create a possible duplicate in another category.`);
      const source = row.imageKey ? imageSources[row.imageKey] : null;
      const explicitClassification = classifyFromExplicitName(row.name);
      creates.push({
        name: row.name.trim(),
        description: typeof row.description === 'string' ? row.description.trim() : '',
        price: row.price,
        categoryName: row.category,
        imageUrl: source ? buildImageUrl(source) : '',
        isVeg: explicitClassification,
        available: true,
        stock: null,
        isFeatured: false,
        customizations: [],
        imageKey: row.imageKey || null,
      });
    } else {
      const existing = matches[0].product;
      const set = {};
      if (existing.name !== row.name.trim()) set.name = row.name.trim();
      if (Number(existing.price) !== row.price) set.price = row.price;
      if (!String(existing.description || '').trim() && String(row.description || '').trim()) set.description = row.description.trim();
      if (!String(existing.imageUrl || '').trim() && row.imageKey) set.imageUrl = buildImageUrl(imageSources[row.imageKey]);
      const explicitClassification = classifyFromExplicitName(row.name);
      if (existing.isVeg !== true && existing.isVeg !== false && explicitClassification !== null) set.isVeg = explicitClassification;
      if ((existing.isVeg === true || existing.isVeg === false) && explicitClassification !== null && existing.isVeg !== explicitClassification) {
        warnings.push({ name: row.name, warning: 'Existing veg/non-veg classification conflicts with the explicit product name; the stored classification was preserved.' });
      }
      if (Number(existing.price) !== row.price) set.price = row.price;
      if (Object.keys(set).length) updates.push({ id: String(existing._id), existingName: existing.name, name: row.name, categoryName: row.category, set });
      else warnings.push({ name: row.name, warning: 'Existing matching product already has the screenshot price; retained without changes.' });
    }
    if (row.imageReviewRequired) reviewItems.push({ name: row.name, category: row.category, note: 'The screenshot identifies the product, but no source-verified matching photo was available; imported with image fallback.' });
    if (row.descriptionReviewRequired) reviewItems.push({ name: row.name, category: row.category, note: 'Screenshot description is clipped; left it blank instead of guessing.' });
    if (row.reviewNote && row.status !== 'needs_review') warnings.push({ name: row.name, warning: row.reviewNote });
  }

  return { missingCategories, creates, updates, reviewItems, warnings };
}

module.exports = { normalizeMenuName, classifyFromExplicitName, buildImageUrl, planMenuImport };
