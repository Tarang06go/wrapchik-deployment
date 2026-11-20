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
  Notification.create = async (record) => ({ _id: 'notice-id', ...record });
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
  } finally {
    Order.findOneAndUpdate = originals.order;
    Notification.create = originals.notice;
    User.findById = originals.user;
    if (originals.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originals.secret;
    socketManager.init(null);
  }
});
