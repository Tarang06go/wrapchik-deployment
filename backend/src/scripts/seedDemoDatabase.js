const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const fs = require('node:fs');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const { assertDemoSeedTarget, assertDemoApplyConfirmation } = require('../utils/demoSeedSafety');
const { normalizeMenuName } = require('../utils/menuImportPlan');
const { buildDemoCataloguePlan } = require('../utils/demoCataloguePlan');

const dataDirectory = path.resolve(__dirname, '../../data');
const manifest = JSON.parse(fs.readFileSync(path.join(dataDirectory, 'menu-import-2026-11-20.json'), 'utf8'));
const imageSources = JSON.parse(fs.readFileSync(path.join(dataDirectory, 'menu-image-sources.json'), 'utf8'));
const apply = process.argv.includes('--apply');
const confirmed = process.argv.includes('--confirm-demo-db');

function validateImageSources() {
  for (const [key, source] of Object.entries(imageSources)) {
    if (!/^photo-[0-9]+-[a-zA-Z0-9]+$/.test(source.photoId || '')) throw new Error(`Image source ${key} has an invalid Unsplash photo ID.`);
    let page;
    try { page = new URL(source.sourcePage); } catch { throw new Error(`Image source ${key} has an invalid source page URL.`); }
    const approvedUnsplashPage = page.protocol === 'https:' && page.hostname === 'unsplash.com' && page.pathname.startsWith('/photos/') && source.license === 'Unsplash License';
    const retainedImageAsset = source.existingAsset === true && page.protocol === 'https:' && page.hostname === 'images.unsplash.com' && page.pathname.includes(source.photoId);
    if (!approvedUnsplashPage && !retainedImageAsset) {
      throw new Error(`Image source ${key} does not have a verified individual Unsplash source page.`);
    }
  }
}

function assertNoDuplicateManifestRows(plan) {
  const imported = [...plan.creates, ...plan.updates];
  const keys = new Set();
  for (const row of imported) {
    const key = `${normalizeMenuName(row.categoryName)}|${normalizeMenuName(row.name)}`;
    if (keys.has(key)) throw new Error(`Demo menu plan has a duplicate row: ${row.name}.`);
    keys.add(key);
  }
}

async function run() {
  validateImageSources();
  assertDemoApplyConfirmation(apply, confirmed);
  const target = assertDemoSeedTarget(process.env.MONGO_DEMO_URI, process.env.NODE_ENV);
  await mongoose.connect(process.env.MONGO_DEMO_URI, { serverSelectionTimeoutMS: 5000, autoIndex: false });
  try {
    const [categories, populatedProducts] = await Promise.all([
      Category.find().sort({ displayOrder: 1, name: 1 }).lean(),
      Product.find().populate('categoryId', 'name').sort({ name: 1 }).lean(),
    ]);
    const existingProducts = populatedProducts.map(product => ({ ...product, categoryName: product.categoryId?.name || '' }));
    const plan = buildDemoCataloguePlan({ manifest, imageSources, existingProducts, existingCategories: categories });
    assertNoDuplicateManifestRows(plan);
    console.log(`[Demo seed] Target: ${target.host}/${target.databaseName} (${apply ? 'APPLY' : 'DRY RUN'}).`);
    console.log(`[Demo seed] Catalogue: ${plan.creates.length} products to add, ${plan.updates.length} safe updates, ${plan.missingCategories.length} categories to add; ${plan.reviewItems.length} rows held for manual review.`);
    console.log('[Demo seed] This script only reads/writes categories and products. It never creates users, orders, payments, or inventory history.');
    for (const row of plan.reviewItems) console.log(`  REVIEW ${row.name}: ${row.note}`);
    if (!apply) {
      console.log('[Demo seed] Dry run complete. Add --apply --confirm-demo-db to seed the isolated local demo database.');
      return;
    }

    const categoriesByKey = new Map(categories.map(category => [normalizeMenuName(category.name), category]));
    for (const category of plan.missingCategories) {
      const source = imageSources[category.imageKey];
      const created = await Category.create({
        name: category.name,
        imageUrl: `https://images.unsplash.com/${source.photoId}?auto=format&fit=crop&crop=entropy&w=1200&h=1200&q=84`,
        displayOrder: category.displayOrder,
      });
      categoriesByKey.set(normalizeMenuName(category.name), created);
    }
    for (const update of plan.updates) await Product.updateOne({ _id: update.id }, { $set: update.set }, { runValidators: true });
    for (const row of plan.creates) {
      const category = categoriesByKey.get(normalizeMenuName(row.categoryName));
      if (!category) throw new Error(`Could not resolve demo category ${row.categoryName}.`);
      const { categoryName, imageKey, ...product } = row;
      await Product.create({ ...product, categoryId: category._id });
    }

    const finalProducts = await Product.find().populate('categoryId', 'name').lean();
    const finalKeys = new Set();
    for (const row of finalProducts) {
      const key = `${normalizeMenuName(row.categoryId?.name)}|${normalizeMenuName(row.name)}`;
      if (finalKeys.has(key)) throw new Error(`Duplicate demo product detected after seed: ${row.name}.`);
      finalKeys.add(key);
    }
    console.log(`[Demo seed] Applied safely. Final product count: ${finalProducts.length}. Existing products were preserved; no orders/payments were accessed.`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) run().catch(error => {
  console.error(`[Demo seed] ${error.message}`);
  process.exitCode = 1;
});

module.exports = { validateImageSources, assertNoDuplicateManifestRows };
