const { normalizeMenuName, planMenuImport } = require('./menuImportPlan');

function buildDemoCataloguePlan({ manifest, imageSources, existingProducts = [], existingCategories = [] }) {
  const categoryMap = new Map((manifest.categories || []).map(category => [normalizeMenuName(category.name), { ...category }]));
  const confirmedRows = (manifest.products || []).filter(row => row.status !== 'needs_review');
  const order = [...categoryMap.values()].length;
  for (const row of confirmedRows) {
    const key = normalizeMenuName(row.category);
    if (categoryMap.has(key)) continue;
    const imageKey = row.imageKey || confirmedRows.find(candidate => normalizeMenuName(candidate.category) === key && candidate.imageKey)?.imageKey;
    if (!imageKey || !imageSources[imageKey]) throw new Error(`Demo category ${row.category} has no validated image source.`);
    categoryMap.set(key, { name: row.category, displayOrder: order + categoryMap.size + 1, imageKey });
  }
  return planMenuImport({
    manifest: { ...manifest, categories: [...categoryMap.values()] },
    imageSources,
    existingProducts,
    existingCategories,
  });
}

module.exports = { buildDemoCataloguePlan };
