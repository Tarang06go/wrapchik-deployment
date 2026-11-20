const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const LoyaltyLedger = require('../models/LoyaltyLedger');
const OrderReview = require('../models/OrderReview');
const { planIndexMigration } = require('../utils/indexMigrationPlan');

const desiredIndexes = [
  { Model: LoyaltyLedger, keys: { orderId: 1, type: 1 }, options: { unique: true, name: 'loyalty_order_entry_once' } },
  { Model: LoyaltyLedger, keys: { userId: 1, createdAt: -1 }, options: { name: 'loyalty_user_history' } },
  { Model: OrderReview, keys: { orderId: 1, userId: 1 }, options: { unique: true, name: 'one_review_per_order_customer' } },
  { Model: OrderReview, keys: { createdAt: -1 }, options: { name: 'createdAt_-1' } },
];

async function getCollectionIndexes(Model) {
  try { return await Model.collection.indexes(); }
  catch (error) {
    if (error.codeName === 'NamespaceNotFound' || error.code === 26) return [];
    throw error;
  }
}

async function ensureLoyaltyIndexes() {
  if (!process.env.MONGO_URI) throw new Error('Set MONGO_URI in backend/.env for the intended database.');
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000, autoIndex: false });
    const indexesByModel = new Map();
    for (const Model of new Set(desiredIndexes.map(item => item.Model))) {
      indexesByModel.set(Model, await getCollectionIndexes(Model));
    }
    const planned = [];
    for (const Model of indexesByModel.keys()) {
      const definitions = desiredIndexes.filter(item => item.Model === Model);
      planned.push(...planIndexMigration(indexesByModel.get(Model), definitions));
    }
    if (planned.some(item => item.Model === LoyaltyLedger && item.options.unique)) {
      const duplicates = await LoyaltyLedger.aggregate([
        { $group: { _id: { orderId: '$orderId', type: '$type' }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $limit: 1 },
      ]);
      if (duplicates.length) throw new Error('Duplicate loyalty entries exist; no index was created and no ledger records were changed.');
    }
    if (planned.some(item => item.Model === OrderReview && item.options.unique)) {
      const duplicateReviews = await OrderReview.aggregate([
        { $group: { _id: { orderId: '$orderId', userId: '$userId' }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $limit: 1 },
      ]);
      if (duplicateReviews.length) throw new Error('Duplicate reviews exist for an order/customer pair; no feature index was created and no records were changed.');
    }
    if (!process.argv.includes('--apply')) {
      console.log(`[Feature indexes] Dry run: ${planned.length} feature indexes are missing. ${planned.length ? `Would create: ${planned.map(item => `${item.Model.collection.collectionName}.${item.options.name}`).join(', ')}.` : 'All declared feature indexes are present.'} No records or indexes were changed.`);
      return;
    }
    for (const item of planned) {
      const name = await item.Model.collection.createIndex(item.keys, item.options);
      console.log(`[Feature indexes] Ensured ${item.Model.collection.collectionName}.${name}.`);
    }
    console.log(`[Feature indexes] Complete. ${planned.length} index(es) ensured; no documents were changed.`);
  } finally { await mongoose.disconnect(); }
}

ensureLoyaltyIndexes().catch(error => {
  console.error(`[Feature indexes] ${error.message}`);
  process.exitCode = 1;
});
