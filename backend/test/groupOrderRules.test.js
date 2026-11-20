const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getActiveMembers,
  countActiveMembers,
  chooseNextLeader,
  isGroupExpired,
} = require('../src/utils/groupOrderRules');

test('group capacity counts only currently joined members', () => {
  const members = [
    { userId: 'student-a', status: 'JOINED' },
    { userId: 'student-b', status: 'LEFT' },
    { userId: 'student-c', status: 'JOINED' },
  ];

  assert.deepEqual(getActiveMembers(members).map((member) => member.userId), ['student-a', 'student-c']);
  assert.equal(countActiveMembers(members), 2);
});

test('leadership transfers to the earliest active member with stable ties', () => {
  const members = [
    { userId: 'leader', status: 'JOINED', joinedAt: '2026-01-01T00:00:00Z' },
    { userId: 'first', status: 'JOINED', joinedAt: '2026-01-02T00:00:00Z' },
    { userId: 'second', status: 'JOINED', joinedAt: '2026-01-02T00:00:00Z' },
    { userId: 'former', status: 'LEFT', joinedAt: '2025-01-01T00:00:00Z' },
  ];

  assert.equal(chooseNextLeader(members, 'leader').userId, 'first');
  assert.equal(chooseNextLeader([{ userId: 'only', status: 'JOINED' }], 'only'), null);
});

test('legacy groups without expiry remain valid; new groups expire at the deadline', () => {
  const now = new Date('2026-11-19T12:00:00Z');

  assert.equal(isGroupExpired({ expiresAt: null }, now), false);
  assert.equal(isGroupExpired({ expiresAt: '2026-11-19T12:00:01Z' }, now), false);
  assert.equal(isGroupExpired({ expiresAt: now }, now), true);
});
