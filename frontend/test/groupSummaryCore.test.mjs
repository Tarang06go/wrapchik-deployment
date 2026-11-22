import test from 'node:test';
import assert from 'node:assert/strict';
import { groupOrderLabel, groupPaymentLabel, isGroupHistory, viewerContributionLabel } from '../utils/groupSummaryCore.mjs';

test('My Groups separates active and history using server group and order states', () => {
  assert.equal(isGroupHistory({ membershipStatus: 'JOINED', status: 'ORDERED', orderStatus: 'PREPARING' }), false);
  assert.equal(isGroupHistory({ membershipStatus: 'JOINED', status: 'COMPLETED', orderStatus: 'COMPLETED' }), true);
  assert.equal(isGroupHistory({ membershipStatus: 'LEFT', status: 'ORDERED', orderStatus: 'PLACED' }), true);
});

test('group labels preserve partial and awaiting-review financial states', () => {
  assert.equal(groupPaymentLabel('PARTIAL_REVIEW'), 'UPI claim awaiting outlet review');
  assert.equal(viewerContributionLabel('CLAIMED'), 'Your reference is awaiting outlet review');
  assert.equal(groupOrderLabel('PREPARING'), 'Preparing');
  assert.equal(groupOrderLabel('COMPLETED'), 'Collected');
  assert.equal(groupOrderLabel(null), 'No order placed');
});
