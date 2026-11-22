const mongoose = require('mongoose');
const GroupOrder = require('../models/GroupOrder');
const Order = require('../models/Order');
const socketManager = require('../config/socketManager');
const { recordGroupActivity } = require('../utils/groupActivity');

const selectReminderTargets = (group, senderId) => {
  const activeIds = new Set((group.members || []).filter(member => member.status === 'JOINED').map(member => String(member.userId)));
  return [...new Set((group.contributions || [])
    .filter(contribution => contribution.status === 'PENDING' && activeIds.has(String(contribution.userId)) && String(contribution.userId) !== String(senderId))
    .map(contribution => String(contribution.userId)))];
};

const sendGroupPaymentReminder = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: 'A valid group is required.' });
    const group = await GroupOrder.findById(id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });
    if (!group.members?.some(member => member.status === 'JOINED' && String(member.userId) === String(req.user._id))) {
      return res.status(403).json({ success: false, message: 'Only current group members can send a payment reminder.' });
    }
    if (group.status !== 'ORDERED' || group.paymentVerifiedAt) return res.status(409).json({ success: false, message: 'This group is not awaiting payment verification.' });
    const order = await Order.findById(group.orderId).select('paymentStatus orderStatus');
    if (!order || order.paymentStatus === 'SUCCESS' || ['CANCELLED', 'REJECTED', 'COMPLETED', 'PICKED_UP', 'DELIVERED', 'SERVED'].includes(order.orderStatus)) {
      return res.status(409).json({ success: false, message: 'This group order is no longer awaiting payment.' });
    }
    const targets = selectReminderTargets(group, req.user._id);
    if (!targets.length) return res.status(409).json({ success: false, message: 'There are no other current members with a payment waiting to be made.' });

    const now = new Date();
    const cooldown = new Date(now.getTime() - 15 * 60 * 1000);
    const reserved = await GroupOrder.findOneAndUpdate({
      _id: group._id,
      status: 'ORDERED',
      members: { $elemMatch: { userId: req.user._id, status: 'JOINED' } },
      $and: [
        { $or: [{ paymentVerifiedAt: null }, { paymentVerifiedAt: { $exists: false } }] },
        { $or: [{ paymentReminderLastSentAt: null }, { paymentReminderLastSentAt: { $exists: false } }, { paymentReminderLastSentAt: { $lte: cooldown } }] },
        { $or: [{ paymentReminderCount: { $lt: 6 } }, { paymentReminderCount: { $exists: false } }] },
      ],
    }, { $set: { paymentReminderLastSentAt: now }, $inc: { paymentReminderCount: 1 } }, { new: true });
    if (!reserved) return res.status(429).json({ success: false, message: 'A reminder was already sent recently or this group has reached its reminder limit. Please wait before trying again.' });

    const { createNotification } = require('./notificationController');
    const notificationResults = await Promise.allSettled(targets.map(userId => createNotification(
      userId,
      `Payment reminder · ${group.name || 'Share a Meal'}`,
      'A group member sent a reminder to review your contribution. If you already submitted a UPI reference, wait for outlet verification.',
      'ORDER_UPDATE',
      order._id,
      `group:${group._id}:payment-reminder:${reserved.paymentReminderCount}:${userId}`,
    )));
    const delivered = notificationResults.filter(result => result.status === 'fulfilled').length;
    if (delivered) {
      await recordGroupActivity({ groupId: group._id, actorId: req.user._id, actorName: req.user.name, type: 'PAYMENT_REMINDER', message: 'Sent a reminder about pending group contributions.' });
      socketManager.emitGroupUpdate(reserved);
    }
    return res.json({ success: true, sentCount: delivered, message: delivered ? 'Payment reminder sent to members with an outstanding contribution.' : 'The reminder could not be delivered. Try again after the cooldown.' });
  } catch (error) { return next(error); }
};

module.exports = { sendGroupPaymentReminder, selectReminderTargets };
