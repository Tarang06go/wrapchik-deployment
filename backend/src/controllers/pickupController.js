const mongoose = require('mongoose');
const Order = require('../models/Order');
const GroupOrder = require('../models/GroupOrder');
const socketManager = require('../config/socketManager');
const { createPickupToken, createGroupPickupToken, hashPickupToken, getVerifiedPickupTokenClaims, verifyPickupToken } = require('../utils/pickupToken');
const { releasePickupSlot } = require('./pickupSlotController');
const { createNotification } = require('./notificationController');
const { notifyJoinedGroupMembers } = require('../utils/groupOrderNotifications');

const PICKUP_QR_LIFETIME_MS = 30 * 60 * 1000;
const secretIsConfigured = () => typeof process.env.JWT_SECRET === 'string' && process.env.JWT_SECRET.length >= 32;
const isFullyPaidGroup = (group) => Boolean(group?.paymentVerifiedAt)
  && Array.isArray(group.contributions)
  && group.contributions.length > 0
  && group.contributions.every((contribution) => contribution.status === 'SUCCESS');

const pickupQrResponse = (res, order, token) => {
  const expiresAt = order.pickupTokenExpiresAt;
  const pickupUri = `wrapchik://admin/pickup?orderId=${encodeURIComponent(String(order._id))}&token=${encodeURIComponent(token)}`;
  return res.json({ success: true, orderId: order._id, orderNumber: order.orderNumber, pickupUri, expiresAt });
};

const findOrderWithPickupSecrets = async (orderFilter) => Order.findOne(orderFilter)
  .select('+pickupTokenHash +pickupTokenExpiresAt');

const issueSharedGroupQr = async (req, res, id) => {
  const group = await GroupOrder.findOne({
    _id: req.body?.groupOrderId,
    orderId: id,
    orderType: 'TAKEAWAY',
    status: 'ORDERED',
    members: { $elemMatch: { userId: req.user._id, status: 'JOINED' } },
  });
  if (!group || !isFullyPaidGroup(group)) {
    return res.status(409).json({ success: false, message: 'A shared pickup QR is available only to current group members after every contribution is verified and the takeaway order is ready.' });
  }

  const baseFilter = { _id: id, groupOrderId: group._id, orderType: 'TAKEAWAY', orderStatus: 'READY', paymentStatus: 'SUCCESS' };
  const current = await findOrderWithPickupSecrets(baseFilter);
  if (!current) return res.status(409).json({ success: false, message: 'A shared pickup QR is available only after the complete group order is paid and ready.' });

  const now = new Date();
  const currentExpiry = current.pickupTokenExpiresAt && new Date(current.pickupTokenExpiresAt);
  if (current.pickupTokenHash && currentExpiry && currentExpiry > now) {
    const sharedToken = createGroupPickupToken(id, group._id, currentExpiry, process.env.JWT_SECRET);
    if (hashPickupToken(sharedToken) === current.pickupTokenHash) return pickupQrResponse(res, current, sharedToken);
    return res.status(409).json({ success: false, message: 'The existing shared pickup QR cannot be safely recovered. Ask an administrator to review this order.' });
  }

  const expiresAt = new Date(now.getTime() + PICKUP_QR_LIFETIME_MS);
  const token = createGroupPickupToken(id, group._id, expiresAt, process.env.JWT_SECRET);
  const issued = await Order.findOneAndUpdate({
    ...baseFilter,
    $or: [
      { pickupTokenHash: null },
      { pickupTokenExpiresAt: null },
      { pickupTokenExpiresAt: { $lte: now } },
    ],
  }, { $set: { pickupTokenHash: hashPickupToken(token), pickupTokenExpiresAt: expiresAt } }, { new: true })
    .select('_id orderNumber +pickupTokenExpiresAt');
  if (issued) return pickupQrResponse(res, issued, token);

  // Another member may have issued the shared QR concurrently. Recreate the
  // winner's deterministic token from its stored expiry instead of rotating it.
  const winner = await findOrderWithPickupSecrets(baseFilter);
  if (winner?.pickupTokenHash && winner.pickupTokenExpiresAt && new Date(winner.pickupTokenExpiresAt) > new Date()) {
    const sharedToken = createGroupPickupToken(id, group._id, winner.pickupTokenExpiresAt, process.env.JWT_SECRET);
    if (hashPickupToken(sharedToken) === winner.pickupTokenHash) return pickupQrResponse(res, winner, sharedToken);
  }
  return res.status(409).json({ success: false, message: 'A shared pickup QR could not be issued. Refresh the order and try again.' });
};

const issuePickupQr = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: 'A valid order is required.' });
    if (!secretIsConfigured()) return res.status(503).json({ success: false, message: 'Secure pickup verification is unavailable until the server signing secret is configured.' });

    // A group order is accessible only after its linked group confirms active
    // membership and aggregate payment verification. The request cannot choose a
    // different group because the lookup binds it to this order id.
    if (req.body?.groupOrderId) {
      if (!mongoose.isValidObjectId(req.body.groupOrderId)) return res.status(400).json({ success: false, message: 'A valid group order is required.' });
      return await issueSharedGroupQr(req, res, id);
    }

    const expiresAt = new Date(Date.now() + PICKUP_QR_LIFETIME_MS);
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
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: 'A valid order and pickup QR are required.' });
    if (!secretIsConfigured()) return res.status(503).json({ success: false, message: 'Secure pickup verification is unavailable until the server signing secret is configured.' });

    const claims = getVerifiedPickupTokenClaims(token, { secret: process.env.JWT_SECRET });
    if (!claims || claims.orderId !== String(id)) return res.status(400).json({ success: false, message: 'This pickup QR is invalid or expired.' });
    let group = null;
    const groupOrderId = claims.groupOrderId || null;
    if (groupOrderId) {
      group = await GroupOrder.findOne({ _id: groupOrderId, orderId: id, orderType: 'TAKEAWAY', status: 'ORDERED' });
      if (!isFullyPaidGroup(group)) return res.status(409).json({ success: false, message: 'The shared pickup QR is unavailable because the group is unpaid, cancelled, or no longer active.' });
    }
    if (!verifyPickupToken(token, { orderId: id, groupOrderId, secret: process.env.JWT_SECRET })) {
      return res.status(400).json({ success: false, message: 'This pickup QR is invalid or expired.' });
    }

    const now = new Date();
    const filter = {
      _id: id,
      orderType: 'TAKEAWAY',
      groupOrderId,
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
    if (group) {
      await require('../utils/groupActivity').recordGroupActivity({ groupId: group._id, actorId: req.user._id, actorName: req.user.name, type: 'PICKUP_COMPLETED', message: 'The outlet verified pickup of the shared order.' });
      await notifyJoinedGroupMembers({
        members: group.members,
        title: `Order #${order.orderNumber} picked up`,
        message: 'Your shared takeaway order was collected.',
        type: 'ORDER_UPDATE',
        orderId: order._id,
        dedupePrefix: `order:${order._id}:status:COMPLETED`,
        createNotification,
      });
    } else {
      const userId = order.userId?._id || order.userId;
      await createNotification(userId, `Order #${order.orderNumber} picked up`, 'Your ready takeaway order was collected.', 'ORDER_UPDATE', order._id, `order:${order._id}:status:COMPLETED`);
    }
    socketManager.emitOrderUpdate(order);
    return res.json({ success: true, message: `Order #${order.orderNumber} pickup verified.`, order });
  } catch (error) { return next(error); }
};

module.exports = { issuePickupQr, verifyPickupQr };
