const test = require('node:test');
const assert = require('node:assert/strict');
const GroupOrder = require('../src/models/GroupOrder');
const Order = require('../src/models/Order');
const GroupActivity = require('../src/models/GroupActivity');
const notifications = require('../src/controllers/notificationController');
const { selectReminderTargets } = require('../src/controllers/groupReminderController');

test('reminders target only other joined members with pending contributions', () => {
  const targets = selectReminderTargets({
    members: [{ userId: 'host', status: 'JOINED' }, { userId: 'joined', status: 'JOINED' }, { userId: 'left', status: 'LEFT' }],
    contributions: [
      { userId: 'host', status: 'PENDING' }, { userId: 'joined', status: 'PENDING' },
      { userId: 'left', status: 'PENDING' }, { userId: 'paid', status: 'SUCCESS' }, { userId: 'claimed', status: 'CLAIMED' },
    ],
  }, 'host');
  assert.deepEqual(targets, ['joined']);
});

test('reminder endpoint enforces current membership and server cooldown without exposing amounts', async () => {
  const originals = { findById: GroupOrder.findById, findOneAndUpdate: GroupOrder.findOneAndUpdate, orderFindById: Order.findById, createNotification: notifications.createNotification, activityCreate: GroupActivity.create };
  const id = '64b000000000000000000001';
  const currentUser = '64b000000000000000000002';
  let reserved = false;
  const group = { _id: id, name: 'Lunch group', status: 'ORDERED', paymentVerifiedAt: null,
    members: [{ userId: currentUser, status: 'JOINED' }, { userId: 'student-b', status: 'JOINED' }],
    contributions: [{ userId: 'student-b', status: 'PENDING', amountPaise: 5000 }] };
  let sent = [];
  GroupOrder.findById = async () => group;
  GroupOrder.findOneAndUpdate = async () => { if (reserved) return null; reserved = true; return { ...group, paymentReminderCount: 1 }; };
  Order.findById = () => ({ select: async () => ({ paymentStatus: 'PENDING', orderStatus: 'PLACED' }) });
  notifications.createNotification = async (...args) => { sent.push(args); return {}; };
  GroupActivity.create = async () => ({});
  const response = () => ({ code: 200, status(value) { this.code = value; return this; }, json(value) { this.payload = value; return this; } });
  try {
    const { sendGroupPaymentReminder } = require('../src/controllers/groupReminderController');
    const unauthorized = response();
    await sendGroupPaymentReminder({ params: { id }, user: { _id: 'outsider' } }, unauthorized, error => { throw error; });
    assert.equal(unauthorized.code, 403);
    assert.equal(sent.length, 0);

    const request = { params: { id }, user: { _id: currentUser, name: 'Host' } };
    const first = response();
    await sendGroupPaymentReminder(request, first, error => { throw error; });
    assert.equal(first.code, 200);
    assert.equal(sent.length, 1);
    assert.equal(sent[0][0], 'student-b');
    assert.equal(first.payload.sentCount, 1);
    assert.doesNotMatch(JSON.stringify(sent[0]), /5000|amountPaise|upiTransactionReference/);

    const second = response();
    await sendGroupPaymentReminder(request, second, error => { throw error; });
    assert.equal(second.code, 429);
    assert.equal(sent.length, 1);
  } finally {
    GroupOrder.findById = originals.findById; GroupOrder.findOneAndUpdate = originals.findOneAndUpdate;
    Order.findById = originals.orderFindById; notifications.createNotification = originals.createNotification;
    GroupActivity.create = originals.activityCreate;
  }
});
