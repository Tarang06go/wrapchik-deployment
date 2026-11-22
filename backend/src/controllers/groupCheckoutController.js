const crypto = require('crypto');
const mongoose = require('mongoose');
const GroupOrder = require('../models/GroupOrder');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const RestaurantSettings = require('../models/RestaurantSettings');
const Table = require('../models/Table');
const socketManager = require('../config/socketManager');
const { calculateVerifiedItems } = require('../utils/orderPricing');
const { reserveStock, restoreStock } = require('../utils/stockReservation');
const { minimumGroupSubtotalPaise, meetsGroupMinimum } = require('../utils/groupMinimumOrder');
const { reserveCoupon, releaseCouponForOrder, previewCoupon } = require('../utils/couponPricing');
const { isUpiConfigured, createUpiPaymentUri } = require('../utils/upiPayment');
const { userKey, allocatePaise, acceptancesComplete } = require('../utils/groupItemAllocation');
const { prepareGroupContributions } = require('../utils/groupCheckoutPricing');
const { hashUpiReference, upiReferenceLookup } = require('../utils/upiReference');
const { updateOrderPaymentStatus } = require('./paymentController');
const { serializeGroupForMember } = require('./groupOrderController');
const { recordGroupActivity } = require('../utils/groupActivity');

const paise = (rupees) => Math.round(Number(rupees) * 100);
const money = (amountPaise) => Number(amountPaise) / 100;
const isActiveMember = (group, userId) => (group.members || []).some((member) => member.status === 'JOINED' && userKey(member.userId) === userKey(userId));
const isClosedOrder = (order) => ['CANCELLED', 'REJECTED', 'COMPLETED', 'PICKED_UP', 'DELIVERED', 'SERVED'].includes(order?.orderStatus);

const repriceCart = async (group) => {
  const requests = group.items.map((item) => ({
    productId: String(item.productId?._id || item.productId),
    quantity: item.quantity,
    customizations: (item.customizations || []).map((entry) => ({ name: entry.name })),
  }));
  const { verifiedItems } = await calculateVerifiedItems(requests);
  let changed = false;
  verifiedItems.forEach((verified, index) => {
    const item = group.items[index];
    const verifiedPaise = paise(verified.itemTotal);
    const oldCustomizations = (item.customizations || []).map((row) => `${row.name}:${Number(row.price).toFixed(2)}`).join('|');
    const newCustomizations = (verified.customizations || []).map((row) => `${row.name}:${Number(row.price).toFixed(2)}`).join('|');
    if (String(item.name) === String(verified.name)
      && paise(item.priceAtPurchase) === paise(verified.priceAtPurchase)
      && Number(item.itemTotalPaise) === verifiedPaise
      && oldCustomizations === newCustomizations) return;
    changed = true;
    item.name = verified.name;
    item.priceAtPurchase = verified.priceAtPurchase;
    item.customizations = verified.customizations;
    item.itemTotalPaise = verifiedPaise;
    item.revision += 1;
    const priorAllocations = item.allocations.map((allocation) => ({
      userId: allocation.userId,
      percentageBps: allocation.percentageBps,
    }));
    const repriced = allocatePaise(verifiedPaise, priorAllocations);
    item.allocations = repriced.map((allocation) => ({
      ...allocation,
      acceptedRevision: item.shareMode === 'SOLO' ? item.revision : null,
      acceptedAt: item.shareMode === 'SOLO' ? new Date() : null,
    }));
  });
  if (changed) {
    group.status = 'OPEN';
    group.lockedAt = null;
    await group.save();
    await recordGroupActivity({ groupId: group._id, type: 'GROUP_STATUS_CHANGED', message: 'The shared cart was repriced and returned to review.' });
    socketManager.emitGroupUpdate(group);
  }
  return { changed, verifiedItems };
};

const groupSnapshot = (group, verifiedItems) => group.items.map((source, index) => ({
  ...verifiedItems[index],
  selectedBy: source.selectedBy,
  shareMode: source.shareMode,
  groupAllocations: allocatePaise(Number(source.itemTotalPaise), source.allocations || []).map((row) => ({
    userId: row.userId,
    amountPaise: row.amountPaise,
  })),
}));

const sendGroupOrder = async (req, res, group, order, statusCode = 201) => {
  group.orderId = order._id;
  const members = group.members.filter((member) => member.status === 'JOINED');
  const activeIds = new Set(members.map((member) => userKey(member.userId)));
  const subtotalPaise = paise(order.subtotal);
  const discountPaise = paise(order.discountAmount || 0);
  const taxPaise = paise(order.taxAndFees || 0);
  const deliveryFeePaise = Math.max(0, paise(order.totalAmount) - (subtotalPaise - discountPaise + taxPaise));
  const pricing = prepareGroupContributions({
    members: members.map((member) => ({ userId: member.userId })),
    items: group.items,
    checkoutMode: group.checkoutMode,
    hostId: group.leaderId,
    discountPaise,
    taxPaise,
    deliveryFeePaise,
  });
  if (pricing.totalPaise !== paise(order.totalAmount)) throw new Error('The group payment breakdown no longer matches the saved order total.');
  group.memberShares = pricing.memberShares.map((row) => ({ userId: row.userId, amountPaise: row.amountPaise }));
  group.contributions = pricing.contributions.map((row) => ({
    userId: row.userId,
    amountPaise: row.amountPaise,
    method: group.paymentMethod,
    status: 'PENDING',
  }));
  if (group.contributions.some((row) => !activeIds.has(userKey(row.userId)))) throw new Error('A payment contribution no longer belongs to an active group member.');
  group.status = 'ORDERED';
  await order.populate('userId', 'name email phone');
  await group.save();
  await recordGroupActivity({ groupId: group._id, actorId: req.user._id, actorName: req.user.name, type: 'ORDER_PLACED', message: 'Placed the group order. Contributions are waiting for outlet review.' });
  try { socketManager.emitGroupUpdate(group); } catch { /* Stored group state is authoritative; clients re-fetch on reconnect. */ }
  try { socketManager.emitOrderUpdate(order); } catch { /* Stored order state is authoritative; clients re-fetch on reconnect. */ }
  const { createNotification } = require('./notificationController');
  await Promise.allSettled(members.map((member) => createNotification(
    member.userId,
    `Group order #${order.orderNumber} placed`,
    group.checkoutMode === 'HOST_PAYS'
      ? 'The group leader is paying the outlet total. Member shares are shown for reference only.'
      : 'Your group contribution is pending outlet payment verification.',
    'ORDER_UPDATE', order._id, `order:${order._id}:group-placed:${userKey(member.userId)}`
  )));
  return res.status(statusCode).json({ success: true, order, group: serializeGroupForMember(group, req.user._id), message: 'Group order placed. Contributions remain pending until the outlet verifies payment.' });
};

const checkoutGroup = async (req, res, next) => {
  let couponReservation = null;
  let createdOrder = null;
  let tableReservedForOrderId = null;
  let stockReservations = [];
  const orderId = new mongoose.Types.ObjectId();
  try {
    const groupId = req.params.id;
    const { checkoutMode, paymentMethod, couponCode } = req.body || {};
    if (!mongoose.isValidObjectId(groupId)) return res.status(400).json({ success: false, message: 'A valid group is required.' });
    if (!['SPLIT', 'HOST_PAYS'].includes(checkoutMode)) return res.status(400).json({ success: false, message: 'Choose individual split payment or host pays.' });
    if (!['UPI_QR', 'COUNTER'].includes(paymentMethod)) return res.status(400).json({ success: false, message: 'Choose UPI or cash at counter.' });

    let group = await GroupOrder.findById(groupId);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });
    if (userKey(group.leaderId) !== userKey(req.user._id)) return res.status(403).json({ success: false, message: 'Only the group leader can place the shared order.' });
    if (!isActiveMember(group, req.user._id)) return res.status(403).json({ success: false, message: 'Only an active group member can check out.' });
    if (group.status === 'ORDERED' && group.orderId) {
      const existing = await Order.findById(group.orderId).populate('userId', 'name email phone');
      if (existing) return res.json({ success: true, group: serializeGroupForMember(group, req.user._id), order: existing, message: 'This group order was already placed.' });
      return res.status(409).json({ success: false, message: 'The linked group order needs administrator review.' });
    }
    if (group.status !== 'LOCKED') return res.status(409).json({ success: false, message: 'Lock the group invite after everyone has reviewed their shares before checkout.' });
    const activeMembers = group.members.filter((member) => member.status === 'JOINED');
    if (activeMembers.length < 2) return res.status(409).json({ success: false, message: 'At least two active group members are required.' });
    if (!group.items.length || group.items.length > 50) return res.status(400).json({ success: false, message: 'The group cart must contain 1–50 item selections.' });
    const unaccepted = group.items.find((item) => item.shareMode === 'SHARED' && !acceptancesComplete(item));
    if (unaccepted) return res.status(409).json({ success: false, message: `Every participant must accept ${unaccepted.name} before checkout.` });

    const { changed, verifiedItems } = await repriceCart(group);
    if (changed) return res.status(409).json({ success: false, message: 'A catalogue price or customization changed. The cart was reopened and affected shares need review.' });
    if (group.items.some((item) => (item.allocations || []).some((share) => !activeMembers.some((member) => userKey(member.userId) === userKey(share.userId))))) {
      return res.status(409).json({ success: false, message: 'A group item has a share assigned to someone who is no longer active. Review the cart before checkout.' });
    }

    const settings = await RestaurantSettings.getSettings();
    if (!settings.acceptingOrders) return res.status(503).json({ success: false, message: 'The outlet is not accepting orders right now.' });
    const typeSetting = { TAKEAWAY: 'takeawayEnabled', DELIVERY: 'deliveryEnabled', DINE_IN: 'dineInEnabled' }[group.orderType];
    if (!typeSetting || settings[typeSetting] !== true) return res.status(409).json({ success: false, message: 'This group fulfilment option is not currently available.' });
    if (paymentMethod === 'UPI_QR' && !isUpiConfigured(settings)) return res.status(503).json({ success: false, message: 'Outlet UPI is not enabled or configured.' });
    if (paymentMethod === 'COUNTER' && settings.cashEnabled === false) return res.status(503).json({ success: false, message: 'Cash at counter is currently unavailable.' });
    if (group.orderType === 'DELIVERY' && (!group.hostel?.trim() || !group.roomNumber?.trim())) return res.status(409).json({ success: false, message: 'This delivery group is missing its hostel or room. Recreate the group with complete delivery details.' });
    if (group.orderType === 'DINE_IN') {
      const table = group.tableId && await Table.findById(group.tableId);
      if (!table || table.status !== 'AVAILABLE') return res.status(409).json({ success: false, message: 'The selected table is no longer available.' });
    }

    const subtotalPaise = verifiedItems.reduce((sum, item) => sum + paise(item.itemTotal), 0);
    if (!Number.isSafeInteger(subtotalPaise) || subtotalPaise <= 0) return res.status(400).json({ success: false, message: 'The server-calculated group subtotal is invalid.' });
    if (!meetsGroupMinimum(settings, subtotalPaise)) return res.status(409).json({ success: false, message: `This group needs an item subtotal of at least ₹${Number(settings.groupMinimumOrderValue).toFixed(2)} before checkout.` });
    const subtotal = money(subtotalPaise);
    if (couponCode !== undefined && (typeof couponCode !== 'string' || couponCode.length > 32)) return res.status(400).json({ success: false, message: 'Enter a valid coupon code.' });
    if (couponCode?.trim()) couponReservation = await reserveCoupon(couponCode, req.user._id, orderId, subtotal);
    const discountAmount = couponReservation?.discountAmount || 0;
    const netSubtotalPaise = subtotalPaise - paise(discountAmount);
    const taxAndFees = money(Math.round(netSubtotalPaise * 0.05));
    const deliveryFee = group.orderType === 'DELIVERY' ? Number(settings.deliveryFee || 0) : 0;
    const totalAmount = money(netSubtotalPaise + paise(taxAndFees) + paise(deliveryFee));
    if (!Number.isFinite(totalAmount) || totalAmount <= 0 || !Number.isSafeInteger(paise(totalAmount))) return res.status(400).json({ success: false, message: 'The server-calculated order total is invalid.' });

    const idempotencyKey = `group-checkout-${String(group._id)}`;
    let order = await Order.findOne({ groupOrderId: group._id });
    if (order && (order.paymentMethod !== paymentMethod || order.groupCheckoutMode !== checkoutMode)) {
      return res.status(409).json({ success: false, message: 'A different checkout mode or payment method already started for this group.' });
    }
    if (!order) {
      stockReservations = await reserveStock(group.items, Product);
      order = await Order.create({
        _id: orderId,
        userId: req.user._id,
        customerSnapshot: { name: req.user.name || '', email: req.user.email || '', phone: req.user.phone || '' },
        orderNumber: `WRP-${crypto.randomInt(100000, 1000000)}`,
        items: groupSnapshot(group, verifiedItems),
        inventoryReservations: stockReservations,
        subtotal,
        taxAndFees,
        totalAmount,
        couponId: couponReservation?.couponId,
        couponCode: couponReservation?.code,
        discountAmount,
        paymentMethod,
        pickupLocation: group.orderType === 'TAKEAWAY' ? require('../utils/pickupLocation').resolvePickupLocation(settings.pickupLocation) : undefined,
        pickupTimeSlot: group.orderType === 'TAKEAWAY' ? '15-20 Mins' : undefined,
        paymentStatus: 'PENDING',
        orderStatus: 'PLACED',
        orderType: group.orderType,
        hostel: group.orderType === 'DELIVERY' ? group.hostel.trim() : undefined,
        roomNumber: group.orderType === 'DELIVERY' ? group.roomNumber.trim() : undefined,
        tableId: group.orderType === 'DINE_IN' ? group.tableId : undefined,
        estimatedPrepTime: settings.estimatedPrepMinutes,
        groupOrderId: group._id,
        groupCheckoutMode: checkoutMode,
        idempotencyKey,
      });
      createdOrder = order;
    }

    if (group.orderType === 'DINE_IN') {
      const table = await Table.findOneAndUpdate({ _id: group.tableId, status: 'AVAILABLE' }, { $set: { status: 'OCCUPIED', currentOrderId: order._id } }, { new: true });
      const alreadyReservedForThisOrder = !table && Boolean(await Table.exists({ _id: group.tableId, status: 'OCCUPIED', currentOrderId: order._id }));
      if (!table && !alreadyReservedForThisOrder) {
        if (createdOrder) await Order.deleteOne({ _id: createdOrder._id });
        if (stockReservations.length) { await restoreStock(stockReservations, Product); stockReservations = []; }
        if (couponReservation) await releaseCouponForOrder({ _id: orderId, couponId: couponReservation.couponId });
        return res.status(409).json({ success: false, message: 'That table was just reserved. Choose another group arrangement.' });
      }
      if (createdOrder) tableReservedForOrderId = order._id;
    }
    if (couponReservation && !createdOrder) await releaseCouponForOrder({ _id: orderId, couponId: couponReservation.couponId });

    group.checkoutMode = checkoutMode;
    group.paymentMethod = paymentMethod;
    return await sendGroupOrder(req, res, group, order, createdOrder ? 201 : 200);
  } catch (error) {
    if (!createdOrder && stockReservations.length) {
      await restoreStock(stockReservations, Product).catch(() => {});
      stockReservations = [];
    }
    if (createdOrder) {
      const persistedGroup = await GroupOrder.findOne({ _id: req.params.id, orderId: createdOrder._id, status: 'ORDERED' });
      if (persistedGroup) {
        const savedOrder = await Order.findById(createdOrder._id).populate('userId', 'name email phone');
        if (savedOrder) return res.status(201).json({ success: true, order: savedOrder, group: serializeGroupForMember(persistedGroup, req.user._id), message: 'Group order placed. Contributions remain pending until the outlet verifies payment.' });
      }
    }
    if (createdOrder) {
      await Order.deleteOne({ _id: createdOrder._id, paymentStatus: 'PENDING' }).catch(() => {});
      if (stockReservations.length) { await restoreStock(stockReservations, Product).catch(() => {}); stockReservations = []; }
      if (tableReservedForOrderId) {
        await Table.updateOne({ _id: tableReservedForOrderId, currentOrderId: createdOrder._id }, { $set: { status: 'AVAILABLE', currentOrderId: null } }).catch(() => {});
      }
    }
    if (couponReservation) {
      await releaseCouponForOrder({ _id: orderId, couponId: couponReservation.couponId }).catch(() => {});
    }
    if (error.code === 11000) {
      const group = await GroupOrder.findById(req.params.id);
      const existing = group?.orderId ? await Order.findById(group.orderId) : await Order.findOne({ idempotencyKey: `group-checkout-${String(req.params.id)}` });
      if (existing && group?.status === 'ORDERED') return res.json({ success: true, group: serializeGroupForMember(group, req.user._id), order: existing, message: 'This group order was already placed.' });
      if (existing && group?.status === 'LOCKED' && existing.groupOrderId?.toString() === group._id.toString()) {
        if (existing.paymentMethod !== paymentMethod || existing.groupCheckoutMode !== checkoutMode) return res.status(409).json({ success: false, message: 'A different checkout mode or payment method already started for this group.' });
        group.checkoutMode = existing.groupCheckoutMode;
        group.paymentMethod = existing.paymentMethod;
        return await sendGroupOrder(req, res, group, existing, 200);
      }
    }
    if (error.name === 'VersionError') {
      const group = await GroupOrder.findById(req.params.id);
      const existing = group?.orderId ? await Order.findById(group.orderId) : null;
      if (group?.status === 'ORDERED' && existing) return res.json({ success: true, group, order: existing, message: 'This group order was already placed.' });
      return res.status(409).json({ success: false, message: 'The group changed during checkout. Refresh and try again.' });
    }
    return next(error);
  }
};

const previewGroupCheckout = async (req, res, next) => {
  try {
    const { checkoutMode = 'SPLIT', couponCode } = req.body || {};
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'A valid group is required.' });
    if (!['SPLIT', 'HOST_PAYS'].includes(checkoutMode)) return res.status(400).json({ success: false, message: 'Choose individual split payment or host pays.' });
    const group = await GroupOrder.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });
    if (!isActiveMember(group, req.user._id)) return res.status(403).json({ success: false, message: 'Only current group members can preview checkout.' });
    if (group.status !== 'LOCKED') return res.status(409).json({ success: false, message: 'Lock the group and collect all shared-dish acceptances before checkout.' });
    const members = group.members.filter((member) => member.status === 'JOINED');
    if (members.length < 2 || !group.items.length) return res.status(409).json({ success: false, message: 'At least two active members and one selected item are required.' });
    if (group.items.some((item) => item.shareMode === 'SHARED' && !acceptancesComplete(item))) return res.status(409).json({ success: false, message: 'Every shared-dish participant must accept the current amount.' });

    const { changed, verifiedItems } = await repriceCart(group);
    if (changed) return res.status(409).json({ success: false, message: 'A catalogue price or customization changed. The cart was reopened and affected shares need review.' });
    const settings = await RestaurantSettings.getSettings();
    if (!settings.acceptingOrders) return res.status(503).json({ success: false, message: 'The outlet is not accepting orders right now.' });
    const typeSetting = { TAKEAWAY: 'takeawayEnabled', DELIVERY: 'deliveryEnabled', DINE_IN: 'dineInEnabled' }[group.orderType];
    if (!typeSetting || settings[typeSetting] !== true) return res.status(409).json({ success: false, message: 'This group fulfilment option is not currently available.' });
    const subtotalPaise = verifiedItems.reduce((sum, item) => sum + paise(item.itemTotal), 0);
    if (!Number.isSafeInteger(subtotalPaise) || subtotalPaise <= 0) return res.status(400).json({ success: false, message: 'The server-calculated group subtotal is invalid.' });
    if (couponCode !== undefined && (typeof couponCode !== 'string' || couponCode.length > 32)) return res.status(400).json({ success: false, message: 'Enter a valid coupon code.' });
    const coupon = couponCode?.trim() ? await previewCoupon(couponCode, group.leaderId, money(subtotalPaise)) : null;
    const discountPaise = paise(coupon?.discountAmount || 0);
    const netSubtotalPaise = subtotalPaise - discountPaise;
    const taxPaise = Math.round(netSubtotalPaise * 0.05);
    const deliveryFeePaise = group.orderType === 'DELIVERY' ? paise(settings.deliveryFee || 0) : 0;
    const totalPaise = netSubtotalPaise + taxPaise + deliveryFeePaise;
    const allocation = prepareGroupContributions({
      members: members.map((member) => ({ userId: member.userId })),
      items: group.items,
      checkoutMode,
      hostId: group.leaderId,
      discountPaise,
      taxPaise,
      deliveryFeePaise,
    });
    if (allocation.totalPaise !== totalPaise) return res.status(409).json({ success: false, message: 'The item share plan does not match the server-calculated total. Refresh the group.' });
    return res.json({
      success: true,
      quote: {
        checkoutMode,
        currency: 'INR',
        subtotalPaise,
        discountPaise,
        discountCode: coupon?.code || null,
        taxAndFeesPaise: taxPaise,
        deliveryFeePaise,
        totalPaise,
        minimumSubtotalPaise: minimumGroupSubtotalPaise(settings),
        meetsMinimumOrder: meetsGroupMinimum(settings, subtotalPaise),
        memberShares: allocation.memberShares,
        contributions: allocation.contributions,
        quoteOnly: true,
        message: 'This quote is not an order or payment. Prices and coupon eligibility are checked again when the leader places the order.',
      },
    });
  } catch (error) { return next(error); }
};

const getContributionInstructions = async (req, res, next) => {
  try {
    const group = await GroupOrder.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });
    const contribution = group.contributions.id(req.params.contributionId);
    if (!contribution) return res.status(404).json({ success: false, message: 'Group payment contribution not found.' });
    if (userKey(contribution.userId) !== userKey(req.user._id) && req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'This contribution belongs to another member.' });
    if (contribution.method !== 'UPI_QR') return res.status(400).json({ success: false, message: 'This contribution uses cash at the counter.' });
    if (contribution.status === 'SUCCESS') return res.status(409).json({ success: false, message: 'This contribution has already been verified.' });
    const order = await Order.findById(group.orderId);
    if (!order) return res.status(409).json({ success: false, message: 'The group order is not available for payment.' });
    if (group.status !== 'ORDERED' || ['CANCELLED', 'REJECTED'].includes(order.orderStatus)) return res.status(409).json({ success: false, message: 'This group order is closed for payment.' });
    const settings = await RestaurantSettings.getSettings();
    if (!isUpiConfigured(settings)) return res.status(503).json({ success: false, message: 'Outlet UPI is not enabled or configured.' });
    const reference = `${order.orderNumber}-G${String(contribution._id).slice(-8)}`;
    const amount = money(contribution.amountPaise);
    const upiUri = createUpiPaymentUri({ upiId: settings.upiId, payeeName: settings.upiPayeeName, amount, orderId: reference, orderNumber: order.orderNumber });
    return res.json({ success: true, instructions: { upiUri, upiId: settings.upiId, payeeName: settings.upiPayeeName, amount, currency: 'INR', orderId: String(order._id), orderNumber: order.orderNumber, contributionId: String(contribution._id), paymentStatus: contribution.status, paymentReference: reference } });
  } catch (error) { return next(error); }
};

const submitContributionReference = async (req, res, next) => {
  try {
    const { transactionReference } = req.body || {};
    const reference = typeof transactionReference === 'string' ? transactionReference.trim() : '';
    if (!/^[A-Za-z0-9-]{8,120}$/.test(reference)) return res.status(400).json({ success: false, message: 'Enter a valid UPI transaction reference (8–120 letters, numbers, or hyphens).' });
    let group = await GroupOrder.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });
    const contribution = group.contributions.id(req.params.contributionId);
    if (!contribution) return res.status(404).json({ success: false, message: 'Group payment contribution not found.' });
    if (userKey(contribution.userId) !== userKey(req.user._id)) return res.status(403).json({ success: false, message: 'Only the assigned member can submit this contribution.' });
    if (contribution.method !== 'UPI_QR') return res.status(400).json({ success: false, message: 'This contribution is not assigned to UPI.' });
    if (contribution.status === 'SUCCESS') return res.status(409).json({ success: false, message: 'This contribution is already verified.' });
    const order = await Order.findById(group.orderId);
    if (group.status !== 'ORDERED' || !order || order.paymentStatus === 'SUCCESS' || isClosedOrder(order)) return res.status(409).json({ success: false, message: 'This group order is closed for payment.' });
    const referenceHash = hashUpiReference(reference);
    const referenceOwner = await Payment.findOne(upiReferenceLookup(reference));
    if (referenceOwner && String(referenceOwner._id) !== String(contribution.paymentId || '')) {
      return res.status(409).json({ success: false, message: 'This UPI transaction reference has already been submitted for another payment.' });
    }
    if (contribution.status === 'CLAIMED') {
      if (contribution.upiTransactionReference === reference && contribution.paymentId) return res.status(202).json({ success: true, paymentStatus: 'PENDING', message: 'This UPI reference is already awaiting outlet verification.' });
      if (contribution.upiTransactionReference !== reference) return res.status(409).json({ success: false, message: 'A UPI reference is already awaiting outlet verification for this contribution.' });
    }
    const settings = await RestaurantSettings.getSettings();
    if (!isUpiConfigured(settings)) return res.status(503).json({ success: false, message: 'Outlet UPI is not enabled or configured.' });
    if (contribution.status !== 'CLAIMED') {
      contribution.status = 'CLAIMED';
      contribution.upiTransactionReference = reference;
      contribution.submittedAt = new Date();
      contribution.verificationReason = null;
      await group.save();
    }
    const referenceDigest = referenceHash.slice(0, 16);
    const gatewayOrderId = `GROUP_UPI_${group._id}_${contribution._id}_${referenceDigest}`;
    let payment = await Payment.findOne({ gatewayOrderId });
    if (!payment) {
      try {
        payment = await Payment.create({
          orderId: order._id,
          groupOrderId: group._id,
          groupContributionId: contribution._id,
          userId: req.user._id,
          gatewayOrderId,
          gateway: 'UPI_QR',
          amount: money(contribution.amountPaise),
          currency: 'INR',
          status: 'PENDING',
          method: 'UPI_QR',
          upiTransactionReference: reference,
          upiReferenceHash: referenceHash,
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        payment = await Payment.findOne({ gatewayOrderId });
        if (!payment) {
          const otherPayment = await Payment.findOne({ upiReferenceHash: referenceHash });
          if (otherPayment) {
            contribution.status = 'PENDING';
            contribution.upiTransactionReference = null;
            contribution.submittedAt = null;
            await group.save();
            return res.status(409).json({ success: false, message: 'This UPI transaction reference has already been submitted for another payment.' });
          }
          throw error;
        }
      }
    }
    if (payment.status === 'FAILED') {
      contribution.status = 'PENDING';
      contribution.upiTransactionReference = null;
      contribution.submittedAt = null;
      await group.save();
      return res.status(409).json({ success: false, message: 'That UPI reference was previously rejected. Submit a new transaction reference after checking your payment.' });
    }
    contribution.paymentId = payment._id;
    await group.save();
    await recordGroupActivity({ groupId: group._id, actorId: req.user._id, actorName: req.user.name, type: action === 'VERIFY' ? 'CONTRIBUTION_VERIFIED' : 'PAYMENT_CLAIM_REJECTED', message: action === 'VERIFY' ? 'An outlet administrator verified a group contribution.' : 'An outlet administrator rejected a UPI claim; the member may review and resubmit.' });
    socketManager.emitGroupUpdate(group);
    await require('./notificationController').notifyAdmins(
      `Group payment claim · order #${order.orderNumber}`,
      `A group member submitted a UPI reference for ₹${money(contribution.amountPaise).toFixed(2)}. Verify the outlet receipt before marking it paid.`,
      'ORDER_UPDATE', order._id, `group:${group._id}:contribution:${contribution._id}:claim:${reference}`
    ).catch(() => {});
    return res.status(202).json({ success: true, paymentStatus: 'PENDING', message: 'UPI reference submitted. The outlet must verify this contribution before it is counted as paid.' });
  } catch (error) {
    if (error.name === 'VersionError') return res.status(409).json({ success: false, message: 'This contribution changed while you submitted it. Refresh and try again.' });
    return next(error);
  }
};

const getPendingGroupContributions = async (req, res, next) => {
  try {
    const groups = await GroupOrder.find({
      status: 'ORDERED',
      paymentVerifiedAt: null,
    }).sort({ updatedAt: 1 }).limit(100).populate('orderId', 'orderNumber totalAmount paymentStatus orderStatus').populate('members.userId', 'name email');
    const payableGroups = groups.filter((group) => !isClosedOrder(group.orderId));
    const contributions = payableGroups.flatMap((group) => (group.contributions || [])
      .filter((contribution) => (contribution.method === 'UPI_QR' && contribution.status === 'CLAIMED') || (contribution.method === 'COUNTER' && contribution.status === 'PENDING'))
      .map((contribution) => ({
        groupId: group._id,
        groupCode: group.groupCode,
        groupOrderNumber: group.orderId?.orderNumber,
        orderId: group.orderId?._id,
        orderStatus: group.orderId?.orderStatus,
        checkoutMode: group.checkoutMode,
        contribution,
        member: group.members.find((member) => userKey(member.userId) === userKey(contribution.userId)) || null,
      })));
    const reconciliations = payableGroups.filter((group) => group.contributions?.length
      && group.contributions.every((contribution) => contribution.status === 'SUCCESS')
      && group.paymentVerifiedAt == null)
      .map((group) => ({ groupId: group._id, groupCode: group.groupCode, orderId: group.orderId?._id, orderNumber: group.orderId?.orderNumber, paymentStatus: group.orderId?.paymentStatus }));
    return res.json({ success: true, contributions: contributions.slice(0, 200), reconciliations });
  } catch (error) { return next(error); }
};

const reconcileGroupPayment = async (req, res, next) => {
  try {
    const group = await GroupOrder.findById(req.params.id);
    if (!group || group.status !== 'ORDERED') return res.status(404).json({ success: false, message: 'An ordered group was not found.' });
    if (!group.contributions?.length || group.contributions.some((contribution) => contribution.status !== 'SUCCESS')) {
      return res.status(409).json({ success: false, message: 'Every member contribution must already be verified before payment reconciliation.' });
    }
    const order = await Order.findById(group.orderId);
    if (!order) return res.status(409).json({ success: false, message: 'The linked order is missing.' });
    const paymentIds = group.contributions.map((contribution) => contribution.paymentId).filter(Boolean);
    const payments = await Payment.find({ _id: { $in: paymentIds }, orderId: order._id, groupOrderId: group._id, status: 'SUCCESS' });
    if (payments.length !== group.contributions.length || group.contributions.some((contribution) => {
      const payment = payments.find((row) => String(row._id) === String(contribution.paymentId));
      return !payment || String(payment.userId) !== String(contribution.userId) || Number(payment.amount) !== money(contribution.amountPaise);
    })) return res.status(409).json({ success: false, message: 'A verified outlet payment record is missing or does not match its assigned contribution.' });
    const verifiedTotalPaise = group.contributions.reduce((sum, contribution) => sum + Number(contribution.amountPaise), 0);
    if (verifiedTotalPaise !== paise(order.totalAmount)) return res.status(409).json({ success: false, message: 'Verified group contributions do not sum to the saved order total. Do not advance this order; contact engineering.' });
    if (order.paymentStatus !== 'SUCCESS') await updateOrderPaymentStatus(order, 'SUCCESS');
    group.paymentVerifiedAt = group.paymentVerifiedAt || new Date();
    await group.save();
    await recordGroupActivity({ groupId: group._id, actorId: req.user._id, actorName: req.user.name, type: 'GROUP_PAYMENT_VERIFIED', message: 'The outlet reconciled all verified contributions to the order.' });
    socketManager.emitGroupUpdate(group);
    return res.json({ success: true, orderId: order._id, paymentStatus: 'SUCCESS', message: 'The verified member contributions now reconcile to the group order total.' });
  } catch (error) {
    if (error.name === 'VersionError') return res.status(409).json({ success: false, message: 'The group payment state changed. Refresh the queue and retry.' });
    return next(error);
  }
};

const reviewGroupContribution = async (req, res, next) => {
  try {
    const { action, reason } = req.body || {};
    if (!['VERIFY', 'REJECT'].includes(action)) return res.status(400).json({ success: false, message: 'Action must be VERIFY or REJECT.' });
    const rejectionReason = typeof reason === 'string' ? reason.trim() : '';
    let group = await GroupOrder.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });
    const contribution = group.contributions.id(req.params.contributionId);
    if (!contribution) return res.status(404).json({ success: false, message: 'Group contribution not found.' });
    if (contribution.status === 'SUCCESS') return res.status(409).json({ success: false, message: 'This contribution was already verified.' });
    if (action === 'REJECT' && (contribution.method !== 'UPI_QR' || contribution.status !== 'CLAIMED' || !rejectionReason || rejectionReason.length > 500)) {
      return res.status(400).json({ success: false, message: 'Rejecting a UPI claim requires a pending UPI reference and a 1–500 character reason.' });
    }
    if (action === 'VERIFY' && contribution.method === 'UPI_QR' && (contribution.status !== 'CLAIMED' || !contribution.upiTransactionReference)) return res.status(409).json({ success: false, message: 'There is no UPI reference awaiting verification.' });
    if (action === 'VERIFY' && contribution.method === 'COUNTER' && contribution.status !== 'PENDING') return res.status(409).json({ success: false, message: 'This counter contribution is not pending.' });
    const order = await Order.findById(group.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'The linked group order was not found.' });
    if (group.status !== 'ORDERED' || isClosedOrder(order)) return res.status(409).json({ success: false, message: 'This order is closed and cannot accept payment verification.' });
    const expectedContributionPaise = group.contributions.reduce((sum, row) => sum + Number(row.amountPaise), 0);
    if (expectedContributionPaise !== paise(order.totalAmount)) return res.status(409).json({ success: false, message: 'The stored contribution plan does not sum to the saved order amount. Do not verify additional payments; contact engineering.' });

    let payment = contribution.paymentId ? await Payment.findById(contribution.paymentId) : null;
    if (contribution.method === 'UPI_QR') {
      if (!payment || payment.orderId.toString() !== order._id.toString() || payment.userId.toString() !== contribution.userId.toString() || Number(payment.amount) !== money(contribution.amountPaise) || payment.method !== 'UPI_QR') {
        return res.status(409).json({ success: false, message: 'The payment record does not match this member contribution.' });
      }
      if (payment.status === 'PENDING') {
        const result = await Payment.updateOne({ _id: payment._id, status: 'PENDING' }, { $set: {
          status: action === 'VERIFY' ? 'SUCCESS' : 'FAILED',
          verificationReason: action === 'REJECT' ? rejectionReason : null,
          verifiedBy: req.user._id,
          verifiedAt: new Date(),
        } });
        if (!result.modifiedCount) return res.status(409).json({ success: false, message: 'Another administrator already reviewed this UPI contribution.' });
      } else if (!(action === 'VERIFY' && payment.status === 'SUCCESS')) {
        return res.status(409).json({ success: false, message: 'The payment attempt is no longer pending.' });
      }
    } else {
      if (action !== 'VERIFY') return res.status(400).json({ success: false, message: 'Cash contributions can only be marked verified after receipt.' });
      if (!payment) {
        const gatewayOrderId = `GROUP_CASH_${order._id}_${contribution._id}`;
        try {
          payment = await Payment.create({
            orderId: order._id, groupOrderId: group._id, groupContributionId: contribution._id,
            userId: contribution.userId, gatewayOrderId,
            gateway: 'COUNTER', amount: money(contribution.amountPaise), currency: 'INR',
            status: 'SUCCESS', method: 'CASH', verifiedBy: req.user._id, verifiedAt: new Date(),
          });
        } catch (error) {
          if (error.code !== 11000) throw error;
          payment = await Payment.findOne({ gatewayOrderId });
          if (!payment || payment.status !== 'SUCCESS') throw error;
        }
      }
    }

    if (action === 'VERIFY') {
      contribution.status = 'SUCCESS';
      contribution.verifiedBy = req.user._id;
      contribution.verifiedAt = new Date();
      contribution.verificationReason = null;
      if (payment) contribution.paymentId = payment._id;
    } else {
      contribution.status = 'PENDING';
      contribution.verificationReason = rejectionReason;
      contribution.paymentId = null;
      contribution.upiTransactionReference = null;
      contribution.submittedAt = null;
      contribution.verifiedBy = req.user._id;
      contribution.verifiedAt = new Date();
    }
    await group.save();
    socketManager.emitGroupUpdate(group);
    if (action === 'VERIFY' && group.contributions.length && group.contributions.every((row) => row.status === 'SUCCESS')) {
      await updateOrderPaymentStatus(order, 'SUCCESS');
      group.paymentVerifiedAt = new Date();
      await group.save();
      await recordGroupActivity({ groupId: group._id, actorId: req.user._id, actorName: req.user.name, type: 'GROUP_PAYMENT_VERIFIED', message: 'The outlet verified all group contributions.' });
      socketManager.emitGroupUpdate(group);
    }
    return res.json({ success: true, contribution, fullyPaid: group.contributions.every((row) => row.status === 'SUCCESS'), message: action === 'VERIFY' ? 'Contribution verified by the outlet.' : 'UPI claim rejected; the student can submit a new reference.' });
  } catch (error) {
    if (error.name === 'VersionError') return res.status(409).json({ success: false, message: 'Group payment state changed during review. Refresh and retry.' });
    return next(error);
  }
};

module.exports = { previewGroupCheckout, checkoutGroup, getContributionInstructions, submitContributionReference, getPendingGroupContributions, reviewGroupContribution, reconcileGroupPayment };
