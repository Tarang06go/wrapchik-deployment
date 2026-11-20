const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const models = ['Order', 'Product', 'Payment', 'GroupOrder'].map(name => require(`../models/${name}`));

const sameObject = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const optionMatches = (actual, expected) => ['unique', 'sparse', 'partialFilterExpression'].every(key =>
  expected[key] === undefined ? !actual[key] : sameObject(actual[key], expected[key]));

async function ensureQueryIndexes() {
  if (!process.env.MONGO_URI) throw new Error('Set MONGO_URI in backend/.env for the intended database.');
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000, autoIndex: false });
    const planned = [];
    for (const Model of models) {
      let actual = [];
      try { actual = await Model.collection.indexes(); }
      catch (error) { if (error.codeName !== 'NamespaceNotFound' && error.code !== 26) throw error; }
      const expectedIndexes = Model.schema.indexes();
      const existingText = actual.find(index => index.weights);
      for (const [keys, options] of expectedIndexes) {
        const isText = Object.values(keys).includes('text');
        if (isText && existingText) {
          const expectedWeights = Object.fromEntries(Object.entries(keys).filter(([, type]) => type === 'text').map(([field]) => [field, 1]));
          if (!sameObject(existingText.weights, expectedWeights)) {
            throw new Error(`${Model.collection.collectionName} already has a different text index; no indexes were created.`);
          }
        }
        const expectedWeights = isText ? Object.fromEntries(Object.entries(keys).filter(([, type]) => type === 'text').map(([field]) => [field, 1])) : null;
        const match = isText
          ? Boolean(existingText && sameObject(existingText.weights, expectedWeights))
          : actual.find(index => sameObject(index.key, keys) && optionMatches(index, options));
        if (!match) {
          const sameKeysDifferentOptions = actual.find(index => sameObject(index.key, keys));
          if (sameKeysDifferentOptions) throw new Error(`${Model.collection.collectionName} has an incompatible index on ${JSON.stringify(keys)}; no indexes were created.`);
          planned.push({ Model, keys, options });
        }
      }
    }
    if (!process.argv.includes('--apply')) {
      console.log(`[Query indexes] Dry run: ${planned.length} additive indexes would be created. No documents or indexes were changed.`);
      for (const item of planned) console.log(`  ${item.Model.collection.collectionName}.${item.options.name || JSON.stringify(item.keys)}`);
      return;
    }
    for (const item of planned) {
      const name = await item.Model.collection.createIndex(item.keys, item.options);
      console.log(`[Query indexes] Ensured ${item.Model.collection.collectionName}.${name}.`);
    }
    console.log('[Query indexes] Completed. No documents were changed or deleted.');
  } finally { await mongoose.disconnect(); }
}

ensureQueryIndexes().catch(error => {
  console.error(`[Query indexes] ${error.message}`);
  process.exitCode = 1;
});
