const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const GroupOrder = require('../src/models/GroupOrder');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');
const User = require('../src/models/User');
const Notification = require('../src/models/Notification');
const GroupActivity = require('../src/models/GroupActivity');
const socketManager = require('../src/config/socketManager');
const { createGroup, joinGroup } = require('../src/controllers/groupOrderController');
const { reviewGroupContribution } = require('../src/controllers/groupCheckoutController');
const { prepareGroupContributions } = require('../src/utils/groupCheckoutPricing');

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('two students can invite/join, split or host-pay, and receive manual payment review in isolated memory', async () => {
  const originals = {
    groupCreate: GroupOrder.create,
    groupFindOneAndUpdate: GroupOrder.findOneAndUpdate,
    groupFindById: GroupOrder.findById,
    orderFindById: Order.findById,
    orderFindOneAndUpdate: Order.findOneAndUpdate,
    paymentFindById: Payment.findById,
    paymentUpdateOne: Payment.updateOne,
    userFindById: User.findById,
    userFind: User.find,
    notificationCreate: Notification.create,
    groupActivityCreate: GroupActivity.create,
  };
  const store = new Map();
  const studentA = new mongoose.Types.ObjectId();
  const studentB = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const paymentId = new mongoose.Types.ObjectId();
  const contributionId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const now = new Date();
  let order;
  let payment;

  GroupOrder.create = async input => {
    const group = { _id: new mongoose.Types.ObjectId(), ...input, status: 'OPEN', items: [], contributions: [], save: async () => group };
    store.set(group.groupCode, group);
    return group;
  };
  GroupOrder.findOneAndUpdate = async filter => {
    const group = store.get(filter.groupCode);
    if (!group || group.status !== 'OPEN' || group.expiresAt <= new Date()) return null;
    if (group.members.some(member => String(member.userId) === String(studentB) && member.status === 'JOINED')) return null;
    if (group.members.filter(member => member.status === 'JOINED').length >= group.maxMembers) return null;
    group.members.push({ userId: studentB, name: 'Student B', status: 'JOINED', joinedAt: now, leftAt: null });
    return group;
  };
  GroupOrder.findById = async id => [...store.values()].find(group => String(group._id) === String(id)) || null;
  Order.findById = async id => String(id) === String(orderId) ? order : null;
  Order.findOneAndUpdate = async (_filter, update) => {
    Object.assign(order, update.$set);
    return order;
  };
  Payment.findById = async id => String(id) === String(paymentId) ? payment : null;
  Payment.updateOne = async (_filter, update) => {
    if (payment.status !== 'PENDING') return { modifiedCount: 0 };
    Object.assign(payment, update.$set);
    return { modifiedCount: 1 };
  };
  User.findById = () => ({ select: async () => null });
  User.find = () => ({ select: async () => [] });
  Notification.create = async record => ({ _id: new mongoose.Types.ObjectId(), ...record });
  GroupActivity.create = async record => ({ _id: new mongoose.Types.ObjectId(), ...record });
  socketManager.init(null);

  try {
    const created = response();
    await createGroup({ body: { orderType: 'TAKEAWAY', maxMembers: 2 }, user: { _id: studentA, name: 'Student A' } }, created, error => { throw error; });
    assert.equal(created.statusCode, 201);
    const group = created.body.group;
    assert.match(group.groupCode, /^[A-F0-9]{6}$/);
    assert.deepEqual(group.members.map(member => String(member.userId)), [String(studentA)]);

    const joined = response();
    await joinGroup({ body: { groupCode: group.groupCode.toLowerCase() }, user: { _id: studentB, name: 'Student B' } }, joined, error => { throw error; });
    assert.equal(joined.body.success, true);
    assert.deepEqual(group.members.map(member => String(member.userId)), [String(studentA), String(studentB)]);

    const items = [{ itemTotalPaise: 5000, allocations: [
      { userId: studentA, amountPaise: 2000 }, { userId: studentB, amountPaise: 3000 },
    ] }];
    const split = prepareGroupContributions({
      members: group.members, items, checkoutMode: 'SPLIT', taxPaise: 500,
    });
    assert.equal(split.totalPaise, 5500);
    assert.deepEqual(split.contributions.map(row => String(row.userId)), [String(studentA), String(studentB)]);
    assert.equal(split.contributions.reduce((sum, row) => sum + row.amountPaise, 0), 5500);

    const hostPays = prepareGroupContributions({
      members: group.members, items, checkoutMode: 'HOST_PAYS', hostId: studentA, taxPaise: 500,
    });
    assert.equal(hostPays.contributions.length, 1);
    assert.equal(String(hostPays.contributions[0].userId), String(studentA));
    assert.equal(hostPays.contributions[0].amountPaise, 5500);

    group.status = 'ORDERED';
    group.orderId = orderId;
    group.checkoutMode = 'HOST_PAYS';
    group.paymentMethod = 'UPI_QR';
    group.memberShares = hostPays.memberShares;
    const contribution = { _id: contributionId, userId: studentA, amountPaise: 5500, method: 'UPI_QR', status: 'CLAIMED', paymentId, upiTransactionReference: 'UTR-TEST-123', submittedAt: now, verifiedBy: null, verifiedAt: null };
    group.contributions = [contribution];
    group.contributions.id = id => group.contributions.find(row => String(row._id) === String(id));
    order = { _id: orderId, userId: studentA, groupOrderId: group._id, orderNumber: 'WRP-TEST', totalAmount: 55, orderStatus: 'PLACED', paymentStatus: 'PENDING', paymentMethod: 'UPI_QR', couponId: null };
    payment = { _id: paymentId, orderId, userId: studentA, amount: 55, method: 'UPI_QR', status: 'PENDING' };

    const reviewed = response();
    await reviewGroupContribution({ params: { id: String(group._id), contributionId: String(contributionId) }, body: { action: 'VERIFY' }, user: { _id: adminId } }, reviewed, error => { throw error; });
    assert.equal(reviewed.body.success, true);
    assert.equal(reviewed.body.fullyPaid, true);
    assert.equal(contribution.status, 'SUCCESS');
    assert.equal(payment.status, 'SUCCESS');
    assert.equal(order.paymentStatus, 'SUCCESS');
  } finally {
    GroupOrder.create = originals.groupCreate;
    GroupOrder.findOneAndUpdate = originals.groupFindOneAndUpdate;
    GroupOrder.findById = originals.groupFindById;
    Order.findById = originals.orderFindById;
    Order.findOneAndUpdate = originals.orderFindOneAndUpdate;
    Payment.findById = originals.paymentFindById;
    Payment.updateOne = originals.paymentUpdateOne;
    User.findById = originals.userFindById;
    User.find = originals.userFind;
    Notification.create = originals.notificationCreate;
    GroupActivity.create = originals.groupActivityCreate;
    socketManager.init(null);
  }
});
