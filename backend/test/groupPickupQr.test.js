const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const Order = require('../src/models/Order');
const GroupOrder = require('../src/models/GroupOrder');
const Notification = require('../src/models/Notification');
const User = require('../src/models/User');
const GroupActivity = require('../src/models/GroupActivity');
const socketManager = require('../src/config/socketManager');
const { issuePickupQr, verifyPickupQr } = require('../src/controllers/pickupController');
const { createGroupPickupToken, hashPickupToken } = require('../src/utils/pickupToken');

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const secret = 'group-pickup-test-secret-with-more-than-thirty-two-characters';

test('joined group members receive the identical QR while only its hash and expiry are stored', async () => {
  const originals = { find: Order.findOne, update: Order.findOneAndUpdate, group: GroupOrder.findOne, secret: process.env.JWT_SECRET };
  const orderId = new mongoose.Types.ObjectId();
  const groupId = new mongoose.Types.ObjectId();
  const group = {
    _id: groupId, orderId, orderType: 'TAKEAWAY', status: 'ORDERED', paymentVerifiedAt: new Date(),
    members: [{ userId: 'student-a', status: 'JOINED' }, { userId: 'student-b', status: 'JOINED' }],
    contributions: [{ status: 'SUCCESS' }, { status: 'SUCCESS' }],
  };
  const state = { _id: orderId, orderNumber: 'WRP-820001', groupOrderId: groupId, orderType: 'TAKEAWAY', orderStatus: 'READY', paymentStatus: 'SUCCESS', pickupTokenHash: null, pickupTokenExpiresAt: null };
  let membershipFilter;
  process.env.JWT_SECRET = secret;
  GroupOrder.findOne = async filter => {
    membershipFilter = filter;
    return filter.members?.$elemMatch?.userId && group.members.some(member => String(member.userId) === String(filter.members.$elemMatch.userId) && member.status === 'JOINED') ? group : null;
  };
  Order.findOne = () => ({ select: async () => ({ ...state }) });
  Order.findOneAndUpdate = (filter, update) => ({ select: async () => {
    const hasCurrentToken = Boolean(state.pickupTokenHash && state.pickupTokenExpiresAt > new Date());
    const canWrite = String(filter._id) === String(orderId) && String(filter.groupOrderId) === String(groupId)
      && filter.orderStatus === state.orderStatus && filter.paymentStatus === state.paymentStatus
      && (!hasCurrentToken || update.$set.pickupTokenHash === state.pickupTokenHash);
    if (!canWrite) return null;
    Object.assign(state, update.$set);
    return { _id: state._id, orderNumber: state.orderNumber, pickupTokenExpiresAt: state.pickupTokenExpiresAt };
  } });
  try {
    const first = response();
    await issuePickupQr({ params: { id: String(orderId) }, body: { groupOrderId: String(groupId) }, user: { _id: 'student-a' } }, first, error => { throw error; });
    const second = response();
    await issuePickupQr({ params: { id: String(orderId) }, body: { groupOrderId: String(groupId) }, user: { _id: 'student-b' } }, second, error => { throw error; });

    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(first.body.pickupUri, second.body.pickupUri);
    assert.ok(membershipFilter.members.$elemMatch.status === 'JOINED');
    assert.match(state.pickupTokenHash, /^[a-f0-9]{64}$/);
    assert.equal(first.body.pickupUri.includes(state.pickupTokenHash), false);
    assert.ok(state.pickupTokenExpiresAt.getTime() <= Date.now() + 30 * 60 * 1000);
    assert.ok(state.pickupTokenExpiresAt.getTime() > Date.now() + 29 * 60 * 1000);
  } finally {
    Order.findOne = originals.find;
    Order.findOneAndUpdate = originals.update;
    GroupOrder.findOne = originals.group;
    if (originals.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originals.secret;
  }
});

test('group QR issuance rejects former members, incomplete group payment, unpaid, cancelled and non-ready orders', async () => {
  const originals = { find: Order.findOne, update: Order.findOneAndUpdate, group: GroupOrder.findOne, secret: process.env.JWT_SECRET };
  const orderId = new mongoose.Types.ObjectId();
  const groupId = new mongoose.Types.ObjectId();
  process.env.JWT_SECRET = secret;
  let currentGroup = { _id: groupId, orderId, orderType: 'TAKEAWAY', status: 'ORDERED', paymentVerifiedAt: new Date(), contributions: [{ status: 'SUCCESS' }], members: [{ userId: 'member', status: 'JOINED' }] };
  let currentOrder = { _id: orderId, groupOrderId: groupId, orderType: 'TAKEAWAY', orderStatus: 'READY', paymentStatus: 'SUCCESS' };
  GroupOrder.findOne = async filter => {
    if (filter.status !== 'ORDERED' || filter.orderType !== 'TAKEAWAY') return null;
    return currentGroup?.members.some(member => String(member.userId) === String(filter.members.$elemMatch.userId) && member.status === 'JOINED') ? currentGroup : null;
  };
  Order.findOne = () => ({ select: async () => currentOrder });
  Order.findOneAndUpdate = () => ({ select: async () => null });
  try {
    const cases = [
      { name: 'former member', user: 'former', group: currentGroup, order: currentOrder },
      { name: 'cancelled group', user: 'member', group: { ...currentGroup, status: 'CANCELLED' }, order: currentOrder },
      { name: 'unverified group contributions', user: 'member', group: { ...currentGroup, paymentVerifiedAt: null }, order: currentOrder },
      { name: 'pending group contribution', user: 'member', group: { ...currentGroup, contributions: [{ status: 'PENDING' }] }, order: currentOrder },
      { name: 'unpaid order', user: 'member', group: currentGroup, order: { ...currentOrder, paymentStatus: 'PENDING' } },
      { name: 'cancelled order', user: 'member', group: currentGroup, order: { ...currentOrder, orderStatus: 'CANCELLED' } },
      { name: 'not-ready order', user: 'member', group: currentGroup, order: { ...currentOrder, orderStatus: 'PREPARING' } },
    ];
    for (const scenario of cases) {
      currentGroup = scenario.group;
      currentOrder = scenario.order;
      const res = response();
      await issuePickupQr({ params: { id: String(orderId) }, body: { groupOrderId: String(groupId) }, user: { _id: scenario.user } }, res, error => { throw error; });
      assert.equal(res.statusCode, 409, `${scenario.name} must be rejected`);
      assert.equal(res.body.success, false);
    }
  } finally {
    Order.findOne = originals.find;
    Order.findOneAndUpdate = originals.update;
    GroupOrder.findOne = originals.group;
    if (originals.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originals.secret;
  }
});

test('admin consumes one shared group QR, notifies every joined member, and leaves payment status unchanged', async () => {
  const originals = { update: Order.findOneAndUpdate, group: GroupOrder.findOne, notice: Notification.create, user: User.findById, activity: GroupActivity.create, secret: process.env.JWT_SECRET };
  const orderId = new mongoose.Types.ObjectId();
  const groupId = new mongoose.Types.ObjectId();
  process.env.JWT_SECRET = secret;
  const expiresAt = new Date(Date.now() + 20 * 60 * 1000);
  const token = createGroupPickupToken(orderId, groupId, expiresAt, secret);
  const group = {
    _id: groupId, orderId, orderType: 'TAKEAWAY', status: 'ORDERED', paymentVerifiedAt: new Date(),
    members: [{ userId: new mongoose.Types.ObjectId(), status: 'JOINED' }, { userId: new mongoose.Types.ObjectId(), status: 'JOINED' }, { userId: new mongoose.Types.ObjectId(), status: 'LEFT' }],
    contributions: [{ status: 'SUCCESS' }, { status: 'SUCCESS' }],
  };
  const expectedRecipients = group.members.slice(0, 2).map(member => String(member.userId)).sort();
  let captured;
  const notices = [];
  let consumed = false;
  GroupOrder.findOne = async filter => String(filter._id) === String(groupId) && String(filter.orderId) === String(orderId) ? group : null;
  Order.findOneAndUpdate = (filter, update) => {
    captured = { filter, update };
    return { populate: async () => {
      if (consumed) return null;
      consumed = true;
      return { _id: orderId, orderNumber: 'WRP-820001', userId: { _id: group.members[0].userId }, orderStatus: 'COMPLETED', paymentStatus: 'SUCCESS', pickupSlotId: null };
    } };
  };
  Notification.create = async record => { notices.push(record); return record; };
  GroupActivity.create = async record => record;
  User.findById = () => ({ select: async () => null });
  socketManager.init(null);
  try {
    const res = response();
    await verifyPickupQr({ params: { id: String(orderId) }, body: { token }, user: { _id: 'admin-id' } }, res, error => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.equal(captured.filter.groupOrderId, String(groupId));
    assert.equal(captured.filter.paymentStatus, 'SUCCESS');
    assert.equal(captured.filter.pickupTokenHash, hashPickupToken(token));
    assert.equal(captured.update.$set.orderStatus, 'COMPLETED');
    assert.equal(Object.hasOwn(captured.update.$set, 'paymentStatus'), false);
    assert.deepEqual(notices.map(notice => String(notice.userId)).sort(), expectedRecipients);
    assert.equal(notices.some(notice => String(notice.userId) === String(group.members[2].userId)), false);
    const replay = response();
    await verifyPickupQr({ params: { id: String(orderId) }, body: { token }, user: { _id: 'admin-id' } }, replay, error => { throw error; });
    assert.equal(replay.statusCode, 409);
    assert.equal(notices.length, 2);
  } finally {
    Order.findOneAndUpdate = originals.update;
    GroupOrder.findOne = originals.group;
    Notification.create = originals.notice;
    User.findById = originals.user;
    GroupActivity.create = originals.activity;
    if (originals.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originals.secret;
    socketManager.init(null);
  }
});

test('expired shared group QR is rejected before database access', async () => {
  const originals = { update: Order.findOneAndUpdate, group: GroupOrder.findOne, secret: process.env.JWT_SECRET };
  const orderId = new mongoose.Types.ObjectId();
  const groupId = new mongoose.Types.ObjectId();
  process.env.JWT_SECRET = secret;
  const token = createGroupPickupToken(orderId, groupId, new Date(Date.now() - 1000), secret);
  let groupLookups = 0;
  GroupOrder.findOne = async () => { groupLookups += 1; return null; };
  Order.findOneAndUpdate = () => { throw new Error('expired tokens must not reach order consume'); };
  try {
    const res = response();
    await verifyPickupQr({ params: { id: String(orderId) }, body: { token }, user: { _id: 'admin-id' } }, res, error => { throw error; });
    assert.equal(res.statusCode, 400);
    assert.equal(groupLookups, 0);
  } finally {
    Order.findOneAndUpdate = originals.update;
    GroupOrder.findOne = originals.group;
    if (originals.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originals.secret;
  }
});

test('invalidated group state prevents admin pickup and admin route stays protected', async () => {
  const originals = { update: Order.findOneAndUpdate, group: GroupOrder.findOne, secret: process.env.JWT_SECRET };
  const orderId = new mongoose.Types.ObjectId();
  const groupId = new mongoose.Types.ObjectId();
  process.env.JWT_SECRET = secret;
  const token = createGroupPickupToken(orderId, groupId, new Date(Date.now() + 10 * 60 * 1000), secret);
  let consumeCalls = 0;
  GroupOrder.findOne = async () => null;
  Order.findOneAndUpdate = () => { consumeCalls += 1; return { populate: async () => null }; };
  try {
    const res = response();
    await verifyPickupQr({ params: { id: String(orderId) }, body: { token }, user: { _id: 'admin-id' } }, res, error => { throw error; });
    assert.equal(res.statusCode, 409);
    assert.equal(consumeCalls, 0);
    const routes = fs.readFileSync(path.join(__dirname, '../src/routes/adminRoutes.js'), 'utf8');
    assert.match(routes, /router\.use\(protect\);\s*router\.use\(adminOnly\);[\s\S]*router\.post\('\/orders\/:id\/pickup\/verify', verifyPickupQr\)/);
  } finally {
    Order.findOneAndUpdate = originals.update;
    GroupOrder.findOne = originals.group;
    if (originals.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originals.secret;
  }
});
