const test = require('node:test');
const assert = require('node:assert/strict');
const { loyaltyPolicyReady, quoteLoyaltyRedemption, earnedPointsForOrder, loyaltyTierForLifetimePoints, validateLoyaltyPolicy } = require('../src/utils/loyaltyRules');

const policy = {
  enabled: true, earnEveryRupees: 100, pointsPerStep: 2, paisePerPoint: 50,
  minimumRedemptionPoints: 10, maxRedemptionPercent: 20,
  tiers: [{ name: 'Regular', minimumLifetimePoints: 0 }, { name: 'Fan', minimumLifetimePoints: 100 }],
};

test('disabled loyalty has no value and earns no points', () => {
  assert.equal(loyaltyPolicyReady({ ...policy, enabled: false }), false);
  assert.deepEqual(quoteLoyaltyRedemption({ policy: { enabled: false }, points: 0, balance: 0, eligibleSubtotalPaise: 10000 }), { points: 0, discountPaise: 0, maximumPoints: 0 });
  assert.equal(earnedPointsForOrder({ policy: { ...policy, enabled: false }, eligibleSpendPaise: 10000 }), 0);
});

test('redemption uses integer paise, checks balance, minimum and configured subtotal cap', () => {
  assert.deepEqual(quoteLoyaltyRedemption({ policy, points: 20, balance: 40, eligibleSubtotalPaise: 10000 }), { points: 20, discountPaise: 1000, maximumPoints: 40 });
  assert.throws(() => quoteLoyaltyRedemption({ policy, points: 41, balance: 50, eligibleSubtotalPaise: 10000 }), /up to 40/);
  assert.throws(() => quoteLoyaltyRedemption({ policy, points: 5, balance: 50, eligibleSubtotalPaise: 10000 }), /at least 10/);
  assert.throws(() => quoteLoyaltyRedemption({ policy, points: 20, balance: 19, eligibleSubtotalPaise: 10000 }), /not have enough/);
});

test('points accrue only in whole eligible spend blocks and tiers use lifetime points', () => {
  assert.equal(earnedPointsForOrder({ policy, eligibleSpendPaise: 19999 }), 2);
  assert.equal(earnedPointsForOrder({ policy, eligibleSpendPaise: 20000 }), 4);
  assert.equal(loyaltyTierForLifetimePoints(policy.tiers, 99).name, 'Regular');
  assert.equal(loyaltyTierForLifetimePoints(policy.tiers, 100).name, 'Fan');
});

test('admin loyalty policy requires explicit earning, redemption and tier values before activation', () => {
  assert.throws(() => validateLoyaltyPolicy({ ...policy, tiers: [] }), /at least one tier/);
  assert.deepEqual(validateLoyaltyPolicy(policy), policy);
  assert.throws(() => validateLoyaltyPolicy({ ...policy, maxRedemptionPercent: 80 }), /within its allowed range/);
  assert.throws(() => validateLoyaltyPolicy({ ...policy, tiers: [{ name: 'A', minimumLifetimePoints: 1 }] }), /starting at 0/);
});
