const test = require('node:test');
const assert = require('node:assert/strict');
const socketManager = require('../src/config/socketManager');

test('group updates are sent only to currently joined members', () => {
  const deliveries = [];
  socketManager.init({ to: (room) => ({ emit: (event, payload) => deliveries.push({ room, event, payload }) }) });
  try {
    socketManager.emitGroupUpdate({
      _id: 'group-1',
      leaderId: 'active-a',
      maxMembers: 4,
      status: 'OPEN',
      members: [
        { userId: 'active-a', status: 'JOINED', name: 'A' },
        { userId: 'active-b', status: 'JOINED', name: 'B' },
        { userId: 'former-member', status: 'LEFT', name: 'Former' },
      ],
      items: [],
      contributions: [],
    });
    assert.deepEqual(deliveries.map((delivery) => delivery.room).sort(), ['user_active-a', 'user_active-b']);
    assert.ok(deliveries.every((delivery) => delivery.event === 'group_updated'));
    assert.ok(deliveries.every((delivery) => !delivery.payload.members.some((member) => member.userId === 'former-member')));
  } finally {
    socketManager.init(null);
  }
});
