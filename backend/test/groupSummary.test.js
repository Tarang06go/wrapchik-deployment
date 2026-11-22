const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeGroup, isGroupHistory } = require('../src/utils/groupSummary');

test('group summary reports safe payment counts, membership and real order progress', () => {
  const summary = summarizeGroup({
    _id: 'group-id', name: 'Lunch together', groupCode: 'A1B2C3', leaderId: 'student-a', status: 'ORDERED',
    members: [{ userId: 'student-a', status: 'JOINED' }, { userId: 'student-b', status: 'JOINED' }, { userId: 'student-c', status: 'LEFT' }],
    contributions: [{ userId: 'student-a', status: 'SUCCESS' }, { userId: 'student-b', status: 'CLAIMED' }],
    orderId: { _id: 'order-id', orderNumber: 'WRP-100100', orderStatus: 'PREPARING', paymentStatus: 'PENDING' },
  }, 'student-b');
  assert.equal(summary.name, 'Lunch together');
  assert.equal(summary.memberCount, 2);
  assert.equal(summary.paymentStatus, 'PARTIAL_REVIEW');
  assert.equal(summary.viewerContributionStatus, 'CLAIMED');
  assert.equal(summary.orderStatus, 'PREPARING');
  assert.equal(summary.orderNumber, 'WRP-100100');
  assert.equal('upiTransactionReference' in summary, false);
  assert.equal(isGroupHistory(summary), false);
});

test('unnamed groups get a safe label and departed or completed groups appear in history', () => {
  const base = { _id: 'group', groupCode: 'C0FFEE', leaderId: 'user', members: [{ userId: 'user', status: 'LEFT' }], contributions: [], status: 'CANCELLED' };
  const summary = summarizeGroup(base, 'user');
  assert.equal(summary.name, 'Share a Meal · C0FFEE');
  assert.equal(isGroupHistory(summary), true);
  assert.equal(isGroupHistory({ ...summary, status: 'ORDERED', membershipStatus: 'LEFT' }), true);
});
