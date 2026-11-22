const test = require('node:test');
const assert = require('node:assert/strict');
const GroupOrder = require('../src/models/GroupOrder');
const socketManager = require('../src/config/socketManager');
const notificationController = require('../src/controllers/notificationController');
const GroupActivity = require('../src/models/GroupActivity');

test('group expiry sweep atomically cancels only expired open invites and is idempotent', async () => {
  const originalFind = GroupOrder.find;
  const originalUpdate = GroupOrder.findOneAndUpdate;
  const originalEmit = socketManager.emitGroupUpdate;
  const originalCreateNotification = notificationController.createNotification;
  const originalActivityCreate = GroupActivity.create;
  const now = new Date('2026-11-20T12:00:00Z');
  const candidates = [{ _id: 'a', status: 'OPEN', members: [{ userId: 'student-a', status: 'JOINED' }] }, { _id: 'b', status: 'OPEN', members: [] }];
  const filters = [];
  const emitted = [];
  const notifications = [];
  GroupOrder.find = filter => ({
    sort(sort) { assert.deepEqual(sort, { expiresAt: 1 }); return this; },
    async limit(limit) { assert.equal(limit, 100); assert.deepEqual(filter, { status: 'OPEN', expiresAt: { $lte: now } }); return candidates; },
  });
  GroupOrder.findOneAndUpdate = async (filter, update, options) => {
    filters.push({ filter, update, options });
    return filter._id === 'a' ? { ...candidates[0], status: 'CANCELLED' } : null;
  };
  socketManager.emitGroupUpdate = group => emitted.push(group._id);
  notificationController.createNotification = async (...args) => { notifications.push(args); return {}; };
  GroupActivity.create = async record => record;
  try {
    const { sweepExpiredGroups } = require('../src/services/groupExpirySweeper');
    const count = await sweepExpiredGroups({ now });
    assert.equal(count, 1);
    assert.deepEqual(emitted, ['a']);
    assert.equal(filters.length, 2);
    assert.deepEqual(filters[0].filter, { _id: 'a', status: 'OPEN', expiresAt: { $lte: now } });
    assert.equal(filters[0].update.$set.status, 'CANCELLED');
    assert.equal(filters[0].update.$set.cancelledAt, now);
    assert.equal(filters[0].options.new, true);
    assert.equal(notifications.length, 1);
    assert.deepEqual(notifications[0], ['student-a', 'Your Share a Meal invite has expired', 'The group invite deadline passed before checkout. Start a new group to order together.', 'SYSTEM', null, 'group:a:expired:student-a']);
  } finally {
    GroupOrder.find = originalFind;
    GroupOrder.findOneAndUpdate = originalUpdate;
    socketManager.emitGroupUpdate = originalEmit;
    notificationController.createNotification = originalCreateNotification;
    GroupActivity.create = originalActivityCreate;
  }
});
