const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const { inspectMenu } = require('../utils/menuAudit');

const main = async () => {
  if (!process.argv.includes('--dry-run')) throw new Error('This read-only checker requires --dry-run. It never modifies catalogue data.');
  const uri = process.env.MENU_AUDIT_MONGO_URI;
  if (!uri) throw new Error('Set MENU_AUDIT_MONGO_URI to a read-only database URI. This script will not fall back to the application database URI.');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, readPreference: 'secondaryPreferred', autoIndex: false });
  try {
    const [products, categories] = await Promise.all([
      Product.find().select('_id name price imageUrl categoryId isVeg').lean(),
      Category.find().select('_id name').lean(),
    ]);
    let referenceItems = null;
    if (process.env.MENU_REFERENCE_JSON) {
      const referencePath = path.resolve(process.env.MENU_REFERENCE_JSON);
      referenceItems = require(referencePath);
      if (!Array.isArray(referenceItems)) throw new Error('MENU_REFERENCE_JSON must contain a JSON array of {name, price} entries.');
    }
    const report = inspectMenu({
      products,
      categories,
      referenceItems,
      knownCategories: ['Burgers', 'Wraps', 'Fries', 'Salads', 'Drinks', 'Popcorn', 'Nuggets', 'Vada Pav', 'Onion Rings'],
    });
    process.stdout.write(`${JSON.stringify({ ...report, note: referenceItems ? undefined : 'No original menu reference was supplied; price/name comparison is unavailable.' }, null, 2)}\n`);
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error) => { console.error(`[Menu Audit] ${error.message}`); process.exitCode = 1; });
