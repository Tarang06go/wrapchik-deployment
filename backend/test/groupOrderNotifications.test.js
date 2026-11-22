const test = require('node:test');
const assert = require('node:assert/strict');
const { notifyJoinedGroupMembers } = require('../src/utils/groupOrderNotifications');

test('group alerts fan out only to joined members, skip the primary recipient, and deduplicate recipients', async () => {
  const created = [];
  const result = await notifyJoinedGroupMembers({
    members: [
      { userId: 'host', status: 'JOINED' },
      { userId: { _id: 'member-a' }, status: 'JOINED' },
      { userId: 'member-a', status: 'JOINED' },
      { userId: 'left-member', status: 'LEFT' },
      { status: 'JOINED' },
    ],
    title: 'Order ready',
    message: 'Meet at pickup.',
    type: 'ORDER_UPDATE',
    orderId: 'order-1',
    dedupePrefix: 'group:g1:order:o1:ready',
    excludeUserId: 'host',
    createNotification: async (...args) => { created.push(args); return args[0]; },
  });
  assert.deepEqual(result, ['member-a']);
  assert.equal(created.length, 1);
  assert.deepEqual(created[0], ['member-a', 'Order ready', 'Meet at pickup.', 'ORDER_UPDATE', 'order-1', 'group:g1:order:o1:ready:member-a']);
});

test('group alert fan-out is a safe no-op without recipients or notification service', async () => {
  assert.deepEqual(await notifyJoinedGroupMembers({ members: [], dedupePrefix: 'group:g:expired', createNotification: async () => {} }), []);
  assert.deepEqual(await notifyJoinedGroupMembers({ members: [{ userId: 'u', status: 'JOINED' }], dedupePrefix: 'group:g:expired' }), []);
});
