const crypto = require('crypto');

const normalizeUpiReference = (reference) => String(reference || '').trim().toUpperCase();
const hashUpiReference = (reference) => crypto.createHash('sha256').update(normalizeUpiReference(reference)).digest('hex');
const upiReferenceLookup = (reference) => {
  const literal = String(reference || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { $or: [
    { upiReferenceHash: hashUpiReference(reference) },
    { upiTransactionReference: { $regex: `^${literal}$`, $options: 'i' } },
  ] };
};

module.exports = { normalizeUpiReference, hashUpiReference, upiReferenceLookup };
