const mongoose = require('mongoose');
const Order = require('../models/Order');
const socketManager = require('../config/socketManager');
const { createPickupToken, hashPickupToken, verifyPickupToken } = require('../utils/pickupToken');
const { releasePickupSlot } = require('./pickupSlotController');
const { createNotification } = require('./notificationController');

const issuePickupQr = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: 'A valid order is required.' });
    if (typeof process.env.JWT_SECRET !== 'string' || process.env.JWT_SECRET.length < 32) return res.status(503).json({ success: false, message: 'Secure pickup verification is unavailable until the server signing secret is configured.' });
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const token = createPickupToken(id, expiresAt, process.env.JWT_SECRET);
    const order = await Order.findOneAndUpdate(
      { _id: id, userId: req.user._id, orderType: 'TAKEAWAY', groupOrderId: null, orderStatus: 'READY', paymentStatus: 'SUCCESS' },
      { $set: { pickupTokenHash: hashPickupToken(token), pickupTokenExpiresAt: expiresAt } },
      { new: true }
    ).select('_id orderNumber');
    if (!order) return res.status(409).json({ success: false, message: 'Pickup QR is available only to the order owner after a paid takeaway order is ready.' });
    const pickupUri = `wrapchik://admin/pickup?orderId=${encodeURIComponent(String(order._id))}&token=${encodeURIComponent(token)}`;
    return res.json({ success: true, orderId: order._id, orderNumber: order.orderNumber, pickupUri, expiresAt });
  } catch (error) { return next(error); }
};

const verifyPickupQr = async (req, res, next) => {
  try {
    const { id } = req.params;
    const token = req.body?.token;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'A valid order and pickup QR are required.' });
    }
    if (typeof process.env.JWT_SECRET !== 'string' || process.env.JWT_SECRET.length < 32) return res.status(503).json({ success: false, message: 'Secure pickup verification is unavailable until the server signing secret is configured.' });
    if (!verifyPickupToken(token, { orderId: id, secret: process.env.JWT_SECRET })) return res.status(400).json({ success: false, message: 'This pickup QR is invalid or expired.' });
    const now = new Date();
    const filter = {
      _id: id,
      orderType: 'TAKEAWAY',
      groupOrderId: null,
      orderStatus: 'READY',
      paymentStatus: 'SUCCESS',
      pickupTokenHash: hashPickupToken(token),
      pickupTokenExpiresAt: { $gt: now },
    };
    const order = await Order.findOneAndUpdate(filter, {
      $set: {
        orderStatus: 'COMPLETED',
        completedAt: now,
        pickupVerifiedAt: now,
        pickupVerifiedBy: req.user._id,
        pickupTokenHash: null,
        pickupTokenExpiresAt: null,
      },
    }, { new: true }).populate('userId', 'name email phone');
    if (!order) return res.status(409).json({ success: false, message: 'This pickup QR is invalid, expired, already used, or the order is not ready and paid.' });
    await releasePickupSlot(order);
    const userId = order.userId?._id || order.userId;
    await createNotification(userId, `Order #${order.orderNumber} picked up`, 'Your ready takeaway order was collected.', 'ORDER_UPDATE', order._id, `order:${order._id}:status:COMPLETED`);
    socketManager.emitOrderUpdate(order);
    return res.json({ success: true, message: `Order #${order.orderNumber} pickup verified.`, order });
  } catch (error) { return next(error); }
};

module.exports = { issuePickupQr, verifyPickupQr };
