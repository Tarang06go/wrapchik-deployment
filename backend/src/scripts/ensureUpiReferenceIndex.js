const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Payment = require('../models/Payment');

async function ensureUpiReferenceIndex() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/wrapchik', { serverSelectionTimeoutMS: 5000, autoIndex: false });
    const duplicate = await Payment.aggregate([
      { $match: { upiReferenceHash: { $type: 'string' } } },
      { $group: { _id: '$upiReferenceHash', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 1 },
    ]);
    if (duplicate.length) throw new Error('Duplicate UPI reference hashes exist; no index was created and no payment records were changed.');
    const name = await Payment.collection.createIndex(
      { upiReferenceHash: 1 },
      { unique: true, sparse: true, name: 'upiReferenceHash_uniqueSparse' }
    );
    console.log(`[Payment index] Ensured ${name}; existing payment documents were not modified.`);
  } finally {
    await mongoose.disconnect();
  }
}

ensureUpiReferenceIndex().catch((error) => {
  console.error(`[Payment index] ${error.message}`);
  process.exitCode = 1;
});
