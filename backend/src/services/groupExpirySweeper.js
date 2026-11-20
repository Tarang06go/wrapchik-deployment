const GroupOrder = require('../models/GroupOrder');
const socketManager = require('../config/socketManager');

const sweepExpiredGroups = async ({ now = new Date(), batchSize = 100 } = {}) => {
  const timestamp = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(timestamp.getTime())) throw new Error('Group expiry sweep requires a valid timestamp.');
  const limit = Number.isInteger(batchSize) ? Math.min(500, Math.max(1, batchSize)) : 100;
  const candidates = await GroupOrder.find({ status: 'OPEN', expiresAt: { $lte: timestamp } })
    .sort({ expiresAt: 1 })
    .limit(limit);
  let expired = 0;
  for (const candidate of candidates) {
    const updated = await GroupOrder.findOneAndUpdate(
      { _id: candidate._id, status: 'OPEN', expiresAt: { $lte: timestamp } },
      { $set: { status: 'CANCELLED', cancelledAt: timestamp } },
      { new: true, runValidators: true },
    );
    if (!updated) continue;
    expired += 1;
    socketManager.emitGroupUpdate(updated);
  }
  return expired;
};

module.exports = { sweepExpiredGroups };
