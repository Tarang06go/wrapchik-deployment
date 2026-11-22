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
    await require('../utils/groupActivity').recordGroupActivity({ groupId: updated._id, type: 'GROUP_EXPIRED', message: 'The group invite expired and the group was closed.', createdAt: timestamp });
    socketManager.emitGroupUpdate(updated);
    const { createNotification } = require('../controllers/notificationController');
    const { notifyJoinedGroupMembers } = require('../utils/groupOrderNotifications');
    await notifyJoinedGroupMembers({
      members: updated.members,
      title: 'Your Share a Meal invite has expired',
      message: 'The group invite deadline passed before checkout. Start a new group to order together.',
      type: 'SYSTEM',
      orderId: updated.orderId || null,
      dedupePrefix: `group:${updated._id}:expired`,
      createNotification,
    });
  }
  return expired;
};

module.exports = { sweepExpiredGroups };
