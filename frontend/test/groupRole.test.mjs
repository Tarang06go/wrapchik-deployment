import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveGroupRole } from '../utils/groupRole.js';

test('group role safely derives leader and joined-member status', () => {
  const group = {
    leaderId: { _id: 'leader-1' },
    members: [
      { userId: { _id: 'leader-1' }, status: 'JOINED' },
      { userId: 'member-2', status: 'JOINED' },
      { userId: 'former-3', status: 'LEFT' },
    ],
  };
  assert.deepEqual(deriveGroupRole(group, 'leader-1'), { isLeader: true, isMember: true });
  assert.deepEqual(deriveGroupRole(group, { _id: 'member-2' }), { isLeader: false, isMember: true });
  assert.deepEqual(deriveGroupRole(group, 'former-3'), { isLeader: false, isMember: false });
});

test('group role handles missing group/user without throwing', () => {
  assert.deepEqual(deriveGroupRole(null, null), { isLeader: false, isMember: false });
  assert.deepEqual(deriveGroupRole({}, 'user-1'), { isLeader: false, isMember: false });
});
