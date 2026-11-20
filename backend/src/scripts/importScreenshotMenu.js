const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const { normalizeMenuName, planMenuImport } = require('../utils/menuImportPlan');

const dataDir = path.resolve(__dirname, '../../data');
const manifest = JSON.parse(fs.readFileSync(path.join(dataDir, 'menu-import-2026-11-20.json'), 'utf8'));
const imageSources = JSON.parse(fs.readFileSync(path.join(dataDir, 'menu-image-sources.json'), 'utf8'));
const apply = process.argv.includes('--apply');
const confirmedDevDb = process.argv.includes('--confirm-dev-db');

function validateImageSources() {
  for (const [key, source] of Object.entries(imageSources)) {
    if (!/^photo-[0-9]+-[a-zA-Z0-9]+$/.test(source.photoId || '')) throw new Error(`Image source ${key} has an invalid Unsplash photo ID.`);
    let sourcePage;
    try { sourcePage = new URL(source.sourcePage); } catch { throw new Error(`Image source ${key} has an invalid source page URL.`); }
    if (sourcePage.protocol !== 'https:' || (sourcePage.hostname !== 'unsplash.com' && sourcePage.hostname !== 'images.unsplash.com')) throw new Error(`Image source ${key} is not hosted by the verified Unsplash domain.`);
    if (source.license !== 'Unsplash License' && source.existingAsset !== true) throw new Error(`Image source ${key} has no verified free-use license.`);
    if (source.license === 'Unsplash License' && (sourcePage.hostname !== 'unsplash.com' || !sourcePage.pathname.startsWith('/photos/'))) throw new Error(`Image source ${key} must include its individual Unsplash photo page.`);
  }
}

function assertDevelopmentDatabase() {
  if (!process.env.MONGO_URI) throw new Error('Set MONGO_URI in backend/.env for the intended development database.');
  const uri = new URL(process.env.MONGO_URI);
  const host = uri.hostname.toLowerCase();
  const databaseName = decodeURIComponent(uri.pathname.slice(1).split('/')[0] || '');
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) || databaseName !== 'wrapchik' || process.env.NODE_ENV === 'production') {
    throw new Error('Import refused: this script only writes to the local development database named wrapchik. No data was changed.');
  }
  if (apply && !confirmedDevDb) throw new Error('Add --confirm-dev-db alongside --apply to explicitly confirm the local wrapchik development database.');
  return { host, databaseName };
}

function countDuplicateGroups(products) {
  const counts = new Map();
  for (const product of products) {
    const categoryName = product.categoryId?.name || product.categoryName || '';
    const key = `${normalizeMenuName(categoryName)}|${normalizeMenuName(product.name)}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([key, count]) => ({ key, count }));
}

async function run() {
  validateImageSources();
  const target = assertDevelopmentDatabase();
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000, autoIndex: false });
    const [existingCategories, populatedProducts] = await Promise.all([
      Category.find().sort({ displayOrder: 1, name: 1 }).lean(),
      Product.find().populate('categoryId', 'name').sort({ name: 1 }).lean(),
    ]);
    const existingProducts = populatedProducts.map(product => ({ ...product, categoryName: product.categoryId?.name || '' }));
    const plan = planMenuImport({ manifest, imageSources, existingProducts, existingCategories });
    const duplicateGroupsBefore = countDuplicateGroups(existingProducts);
    console.log(`[Menu import] Target: ${target.host}/${target.databaseName} (${apply ? 'APPLY' : 'DRY RUN'}).`);
    console.log(`[Menu import] Screenshot unique rows: ${manifest.products.length}; confirmed: ${manifest.products.filter(item => item.status !== 'needs_review').length}; held for exact-name review: ${plan.reviewItems.filter(item => item.note.includes('truncates')).length}.`);
    console.log(`[Menu import] Existing products: ${existingProducts.length}; exact/approved-alias updates: ${plan.updates.length}; new products: ${plan.creates.length}; new categories: ${plan.missingCategories.length}.`);
    console.log(`[Menu import] Existing duplicate product groups: ${duplicateGroupsBefore.length}; product image URLs use 1200x1200 crop transforms. No orders/payments are queried or changed.`);
    for (const category of plan.missingCategories) console.log(`  CATEGORY + ${category.name}`);
    for (const update of plan.updates) console.log(`  UPDATE ${update.existingName} → ${update.name}: ${JSON.stringify(update.set)}`);
    for (const product of plan.creates) console.log(`  ADD ${product.name} | ₹${product.price} | ${product.categoryName} | ${product.imageKey ? 'HD Unsplash image' : 'manual image review'}`);
    for (const item of plan.reviewItems) console.log(`  REVIEW ${item.name}: ${item.note}`);
    for (const warning of plan.warnings) console.log(`  NOTE ${warning.name}: ${warning.warning}`);
    if (!apply) {
      console.log('[Menu import] Dry run only. No categories or products were changed. Re-run with --apply --confirm-dev-db after reviewing this plan.');
      return;
    }

    const categoryByKey = new Map(existingCategories.map(category => [normalizeMenuName(category.name), category]));
    for (const category of plan.missingCategories) {
      const source = imageSources[category.imageKey];
      const created = await Category.create({
        name: category.name,
        imageUrl: `https://images.unsplash.com/${source.photoId}?auto=format&fit=crop&crop=entropy&w=1200&h=1200&q=84`,
        displayOrder: category.displayOrder,
      });
      categoryByKey.set(normalizeMenuName(created.name), created.toObject());
    }
    for (const update of plan.updates) {
      await Product.updateOne({ _id: update.id }, { $set: update.set }, { runValidators: true });
    }
    for (const product of plan.creates) {
      const category = categoryByKey.get(normalizeMenuName(product.categoryName));
      if (!category) throw new Error(`Category ${product.categoryName} was not available after creation; later rows stopped.`);
      const { categoryName, imageKey, ...fields } = product;
      await Product.create({ ...fields, categoryId: category._id });
    }

    const [finalCategories, finalProducts] = await Promise.all([
      Category.find().lean(),
      Product.find().populate('categoryId', 'name').lean(),
    ]);
    const duplicateGroupsAfter = countDuplicateGroups(finalProducts);
    const finalByNameAndCategory = new Map(finalProducts.map(product => [`${normalizeMenuName(product.categoryId?.name || '')}|${normalizeMenuName(product.name)}`, product]));
    const failedChecks = [];
    for (const row of manifest.products.filter(item => item.status !== 'needs_review')) {
      const exactKey = `${normalizeMenuName(row.category)}|${normalizeMenuName(row.name)}`;
      const aliasKeys = (row.aliases || []).map(alias => `${normalizeMenuName(row.category)}|${normalizeMenuName(alias)}`);
      const product = finalByNameAndCategory.get(exactKey) || aliasKeys.map(key => finalByNameAndCategory.get(key)).find(Boolean);
      if (!product) failedChecks.push(`${row.name}: missing after import`);
      else if (Number(product.price) !== row.price) failedChecks.push(`${row.name}: stored price ${product.price} differs from screenshot price ${row.price}`);
      else if (!product.categoryId?.name || normalizeMenuName(product.categoryId.name) !== normalizeMenuName(row.category)) failedChecks.push(`${row.name}: category mismatch`);
      else if (product.imageUrl && !product.imageUrl.startsWith('https://')) failedChecks.push(`${row.name}: image URL must use HTTPS`);
      else if (row.imageKey) {
        const createdByThisImport = plan.creates.some(item => normalizeMenuName(item.name) === normalizeMenuName(row.name) && normalizeMenuName(item.categoryName) === normalizeMenuName(row.category));
        if (createdByThisImport && product.imageUrl !== `https://images.unsplash.com/${imageSources[row.imageKey].photoId}?auto=format&fit=crop&crop=entropy&w=1200&h=1200&q=84`) {
          failedChecks.push(`${row.name}: newly imported product is missing its verified 1200x1200 Unsplash rendition`);
        }
      }
    }
    console.log(`[Menu import] Applied. Final products: ${finalProducts.length}; categories: ${finalCategories.length}; duplicate groups: ${duplicateGroupsAfter.length}.`);
    if (failedChecks.length) throw new Error(`Post-import verification failed: ${failedChecks.join('; ')}`);
    if (duplicateGroupsAfter.length > duplicateGroupsBefore.length) throw new Error('Duplicate product groups increased; review the development catalogue before using it.');
    console.log('[Menu import] Post-import price/category/image/duplicate checks passed. No existing product was deleted; orders and payments were not accessed.');
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(error => {
  console.error(`[Menu import] ${error.message}`);
  process.exitCode = 1;
});
