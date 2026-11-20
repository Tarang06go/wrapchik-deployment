const test = require('node:test');
const assert = require('node:assert/strict');
const GroupOrder = require('../src/models/GroupOrder');
const socketManager = require('../src/config/socketManager');

test('group expiry sweep atomically cancels only expired open invites and is idempotent', async () => {
  const originalFind = GroupOrder.find;
  const originalUpdate = GroupOrder.findOneAndUpdate;
  const originalEmit = socketManager.emitGroupUpdate;
  const now = new Date('2026-11-20T12:00:00Z');
  const candidates = [{ _id: 'a', status: 'OPEN' }, { _id: 'b', status: 'OPEN' }];
  const filters = [];
  const emitted = [];
  GroupOrder.find = filter => ({
    sort(sort) { assert.deepEqual(sort, { expiresAt: 1 }); return this; },
    async limit(limit) { assert.equal(limit, 100); assert.deepEqual(filter, { status: 'OPEN', expiresAt: { $lte: now } }); return candidates; },
  });
  GroupOrder.findOneAndUpdate = async (filter, update, options) => {
    filters.push({ filter, update, options });
    return filter._id === 'a' ? { ...candidates[0], status: 'CANCELLED' } : null;
  };
  socketManager.emitGroupUpdate = group => emitted.push(group._id);
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
  } finally {
    GroupOrder.find = originalFind;
    GroupOrder.findOneAndUpdate = originalUpdate;
    socketManager.emitGroupUpdate = originalEmit;
  }
});
