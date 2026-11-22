import test from 'node:test';
import assert from 'node:assert/strict';
import { newlyCreditedLoyaltyPoints } from '../utils/loyaltyCelebrationCore.js';

test('points celebration is emitted only for a newly credited paid completed individual order', () => {
  const prior = { loyaltyPointsEarned: 0 };
  const credited = { loyaltyPointsEarned: 12, paymentStatus: 'SUCCESS', orderStatus: 'COMPLETED' };
  assert.equal(newlyCreditedLoyaltyPoints(prior, credited), 12);
  assert.equal(newlyCreditedLoyaltyPoints(null, credited), 0);
  assert.equal(newlyCreditedLoyaltyPoints({ loyaltyPointsEarned: 12 }, credited), 0);
  assert.equal(newlyCreditedLoyaltyPoints(prior, { ...credited, paymentStatus: 'PENDING' }), 0);
  assert.equal(newlyCreditedLoyaltyPoints(prior, { ...credited, groupOrderId: 'group' }), 0);
  assert.equal(newlyCreditedLoyaltyPoints(prior, { ...credited, orderStatus: 'READY' }), 0);
});
