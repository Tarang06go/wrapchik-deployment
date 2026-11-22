const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Order = require('../src/models/Order');
const Notification = require('../src/models/Notification');
const User = require('../src/models/User');
const socketManager = require('../src/config/socketManager');
const { issuePickupQr, verifyPickupQr } = require('../src/controllers/pickupController');
const { createPickupToken, hashPickupToken } = require('../src/utils/pickupToken');

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('only the owner can receive a hashed-token QR for a ready paid takeaway', async () => {
  const original = Order.findOneAndUpdate;
  const originalSecret = process.env.JWT_SECRET;
  const orderId = new mongoose.Types.ObjectId();
  process.env.JWT_SECRET = 'pickup-controller-test-secret-with-more-than-thirty-two-chars';
  let captured;
  Order.findOneAndUpdate = (filter, update) => {
    captured = { filter, update };
    return { select: async () => ({ _id: orderId, orderNumber: 'WRP-123456' }) };
  };
  try {
    const res = response();
    await issuePickupQr({ params: { id: String(orderId) }, user: { _id: 'owner-id' } }, res, (error) => { throw error; });
    assert.equal(res.body.success, true);
    assert.equal(captured.filter.userId, 'owner-id');
    assert.equal(captured.filter.orderStatus, 'READY');
    assert.equal(captured.filter.paymentStatus, 'SUCCESS');
    assert.equal(captured.filter.orderType, 'TAKEAWAY');
    assert.match(captured.update.$set.pickupTokenHash, /^[a-f0-9]{64}$/);
    assert.match(res.body.pickupUri, /^wrapchik:\/\/admin\/pickup\?orderId=/);
    assert.ok(!res.body.pickupUri.includes(captured.update.$set.pickupTokenHash));
  } finally {
    Order.findOneAndUpdate = original;
    if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
  }
});

test('admin pickup verification atomically consumes the QR without changing payment state', async () => {
  const originals = { order: Order.findOneAndUpdate, notice: Notification.create, user: User.findById, secret: process.env.JWT_SECRET };
  const orderId = new mongoose.Types.ObjectId();
  process.env.JWT_SECRET = 'pickup-controller-test-secret-with-more-than-thirty-two-chars';
  const token = createPickupToken(orderId, new Date(Date.now() + 30 * 60 * 1000), process.env.JWT_SECRET);
  const order = { _id: orderId, orderNumber: 'WRP-123456', userId: { _id: 'student-id' }, pickupSlotId: null, orderStatus: 'COMPLETED', paymentStatus: 'SUCCESS' };
  let captured;
  Order.findOneAndUpdate = (filter, update) => {
    captured = { filter, update };
    return { populate: async () => order };
  };
  let pickupNotice;
  Notification.create = async (record) => { pickupNotice = record; return { _id: 'notice-id', ...record }; };
  User.findById = () => ({ select: async () => null });
  socketManager.init({ to: () => ({ emit() {} }) });
  try {
    const res = response();
    await verifyPickupQr({ params: { id: String(orderId) }, body: { token }, user: { _id: 'admin-id' } }, res, (error) => { throw error; });
    assert.equal(res.body.success, true);
    assert.equal(captured.filter.pickupTokenHash, hashPickupToken(token));
    assert.ok(captured.filter.pickupTokenExpiresAt.$gt instanceof Date);
    assert.equal(captured.filter.paymentStatus, 'SUCCESS');
    assert.equal(captured.update.$set.orderStatus, 'COMPLETED');
    assert.equal(String(captured.update.$set.pickupVerifiedBy), 'admin-id');
    assert.equal(captured.update.$set.pickupTokenHash, null);
    assert.equal(Object.hasOwn(captured.update.$set, 'paymentStatus'), false);
    assert.equal(pickupNotice.userId, 'student-id');
    assert.equal(pickupNotice.dedupeKey, `order:${orderId}:status:COMPLETED`);
  } finally {
    Order.findOneAndUpdate = originals.order;
    Notification.create = originals.notice;
    User.findById = originals.user;
    if (originals.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originals.secret;
    socketManager.init(null);
  }
});

test('pickup QR issuance rejects unpaid, cancelled, non-ready, dine-in, and group orders', async () => {
  const originalOrder = Order.findOneAndUpdate;
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'pickup-controller-test-secret-with-more-than-thirty-two-chars';
  const orderId = new mongoose.Types.ObjectId();
  const invalidOrders = [
    { orderStatus: 'READY', paymentStatus: 'PENDING', orderType: 'TAKEAWAY', groupOrderId: null },
    { orderStatus: 'CANCELLED', paymentStatus: 'SUCCESS', orderType: 'TAKEAWAY', groupOrderId: null },
    { orderStatus: 'PREPARING', paymentStatus: 'SUCCESS', orderType: 'TAKEAWAY', groupOrderId: null },
    { orderStatus: 'READY', paymentStatus: 'SUCCESS', orderType: 'DINE_IN', groupOrderId: null },
    { orderStatus: 'READY', paymentStatus: 'SUCCESS', orderType: 'TAKEAWAY', groupOrderId: new mongoose.Types.ObjectId() },
  ];
  let current;
  Order.findOneAndUpdate = (filter) => ({ select: async () => {
    const eligible = current.orderStatus === filter.orderStatus
      && current.paymentStatus === filter.paymentStatus
      && current.orderType === filter.orderType
      && String(current.groupOrderId) === String(filter.groupOrderId);
    return eligible ? { _id: orderId, orderNumber: 'WRP-123456' } : null;
  } });
  try {
    for (const order of invalidOrders) {
      current = order;
      const res = response();
      await issuePickupQr({ params: { id: String(orderId) }, user: { _id: 'owner-id' } }, res, (error) => { throw error; });
      assert.equal(res.statusCode, 409, `${order.orderStatus}/${order.paymentStatus}/${order.orderType} must be rejected`);
      assert.equal(res.body.success, false);
    }
  } finally {
    Order.findOneAndUpdate = originalOrder;
    if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
  }
});

test('pickup verification rejects forged and expired signed tokens before database access', async () => {
  const originalOrder = Order.findOneAndUpdate;
  const originalSecret = process.env.JWT_SECRET;
  const secret = 'pickup-controller-test-secret-with-more-than-thirty-two-chars';
  const orderId = new mongoose.Types.ObjectId();
  process.env.JWT_SECRET = secret;
  let databaseCalls = 0;
  Order.findOneAndUpdate = () => { databaseCalls += 1; return { populate: async () => null }; };
  try {
    const forged = response();
    await verifyPickupQr({ params: { id: String(orderId) }, body: { token: 'not-a-valid-signed-pickup-token' }, user: { _id: 'admin-id' } }, forged, error => { throw error; });
    assert.equal(forged.statusCode, 400);
    assert.equal(databaseCalls, 0);

    const expiredToken = createPickupToken(orderId, new Date(Date.now() - 1000), secret);
    const expired = response();
    await verifyPickupQr({ params: { id: String(orderId) }, body: { token: expiredToken }, user: { _id: 'admin-id' } }, expired, error => { throw error; });
    assert.equal(expired.statusCode, 400);
    assert.equal(databaseCalls, 0);
  } finally {
    Order.findOneAndUpdate = originalOrder;
    if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
  }
});

test('an expired stored QR and unpaid/cancelled/non-ready orders fail the atomic consume filter', async () => {
  const originalOrder = Order.findOneAndUpdate;
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'pickup-controller-test-secret-with-more-than-thirty-two-chars';
  const orderId = new mongoose.Types.ObjectId();
  const token = createPickupToken(orderId, new Date(Date.now() + 30 * 60 * 1000), process.env.JWT_SECRET);
  let state;
  let capturedFilter;
  Order.findOneAndUpdate = (filter) => {
    capturedFilter = filter;
    const eligible = state.orderType === filter.orderType
      && state.orderStatus === filter.orderStatus
      && state.paymentStatus === filter.paymentStatus
      && String(state.groupOrderId) === String(filter.groupOrderId)
      && state.pickupTokenHash === filter.pickupTokenHash
      && state.pickupTokenExpiresAt > filter.pickupTokenExpiresAt.$gt;
    return { populate: async () => eligible ? null : null };
  };
  try {
    const scenarios = [
      { orderStatus: 'READY', paymentStatus: 'SUCCESS', pickupTokenExpiresAt: new Date(Date.now() - 1000) },
      { orderStatus: 'READY', paymentStatus: 'PENDING', pickupTokenExpiresAt: new Date(Date.now() + 1000) },
      { orderStatus: 'CANCELLED', paymentStatus: 'SUCCESS', pickupTokenExpiresAt: new Date(Date.now() + 1000) },
      { orderStatus: 'PREPARING', paymentStatus: 'SUCCESS', pickupTokenExpiresAt: new Date(Date.now() + 1000) },
    ];
    for (const scenario of scenarios) {
      state = { orderType: 'TAKEAWAY', groupOrderId: null, pickupTokenHash: hashPickupToken(token), ...scenario };
      const res = response();
      await verifyPickupQr({ params: { id: String(orderId) }, body: { token }, user: { _id: 'admin-id' } }, res, error => { throw error; });
      assert.equal(res.statusCode, 409);
      assert.equal(capturedFilter.orderStatus, 'READY');
      assert.equal(capturedFilter.paymentStatus, 'SUCCESS');
      assert.ok(capturedFilter.pickupTokenExpiresAt.$gt instanceof Date);
    }
  } finally {
    Order.findOneAndUpdate = originalOrder;
    if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
  }
});

test('pickup QR can be consumed once; replay and post-completion reuse are rejected', async () => {
  const originals = { order: Order.findOneAndUpdate, notice: Notification.create, user: User.findById, secret: process.env.JWT_SECRET };
  const orderId = new mongoose.Types.ObjectId();
  process.env.JWT_SECRET = 'pickup-controller-test-secret-with-more-than-thirty-two-chars';
  const token = createPickupToken(orderId, new Date(Date.now() + 30 * 60 * 1000), process.env.JWT_SECRET);
  const state = { orderType: 'TAKEAWAY', groupOrderId: null, orderStatus: 'READY', paymentStatus: 'SUCCESS', pickupTokenHash: hashPickupToken(token), pickupTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000) };
  let noticeCount = 0;
  Order.findOneAndUpdate = (filter, update) => ({ populate: async () => {
    const eligible = Object.entries({ orderType: filter.orderType, groupOrderId: filter.groupOrderId, orderStatus: filter.orderStatus, paymentStatus: filter.paymentStatus, pickupTokenHash: filter.pickupTokenHash }).every(([key, value]) => String(state[key]) === String(value))
      && state.pickupTokenExpiresAt > filter.pickupTokenExpiresAt.$gt;
    if (!eligible) return null;
    Object.assign(state, update.$set);
    return { _id: orderId, orderNumber: 'WRP-123456', userId: { _id: 'student-id' }, ...state };
  } });
  Notification.create = async record => { noticeCount += 1; return { _id: `notice-${noticeCount}`, ...record }; };
  User.findById = () => ({ select: async () => null });
  socketManager.init(null);
  try {
    const first = response();
    await verifyPickupQr({ params: { id: String(orderId) }, body: { token }, user: { _id: 'admin-id' } }, first, error => { throw error; });
    assert.equal(first.statusCode, 200);
    assert.equal(state.orderStatus, 'COMPLETED');
    assert.equal(state.paymentStatus, 'SUCCESS');
    assert.equal(state.pickupTokenHash, null);
    const replay = response();
    await verifyPickupQr({ params: { id: String(orderId) }, body: { token }, user: { _id: 'admin-id' } }, replay, error => { throw error; });
    assert.equal(replay.statusCode, 409);
    assert.equal(noticeCount, 1);
  } finally {
    Order.findOneAndUpdate = originals.order;
    Notification.create = originals.notice;
    User.findById = originals.user;
    if (originals.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originals.secret;
    socketManager.init(null);
  }
});
