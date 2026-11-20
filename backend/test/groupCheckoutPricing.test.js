const test = require('node:test');
const assert = require('node:assert/strict');
const { allocateByWeightsPaise, prepareGroupContributions } = require('../src/utils/groupCheckoutPricing');

test('weighted paise allocation is exact and resolves ties by stable user id', () => {
  assert.deepEqual(allocateByWeightsPaise(5, [
    { userId: 'b', weight: 1 }, { userId: 'a', weight: 1 }, { userId: 'c', weight: 1 },
  ]), [
    { userId: 'b', amountPaise: 2 }, { userId: 'a', amountPaise: 2 }, { userId: 'c', amountPaise: 1 },
  ]);
});

test('split contributions include allocated dishes, coupon discount, tax, and equal delivery fee', () => {
  const result = prepareGroupContributions({
    members: [{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }],
    items: [{ itemTotalPaise: 10001, allocations: [
      { userId: 'a', amountPaise: 5001 }, { userId: 'b', amountPaise: 5000 },
    ] }],
    checkoutMode: 'SPLIT', discountPaise: 1000, taxPaise: 450, deliveryFeePaise: 2000,
  });
  assert.equal(result.subtotalPaise, 10001);
  assert.equal(result.totalPaise, 11451);
  assert.equal(result.memberShares.reduce((sum, row) => sum + row.amountPaise, 0), result.totalPaise);
  assert.deepEqual(result.contributions, result.memberShares.filter((row) => row.amountPaise > 0));
});

test('host-pay creates one full payment obligation while retaining informational member shares', () => {
  const result = prepareGroupContributions({
    members: [{ userId: 'host' }, { userId: 'friend' }],
    items: [{ itemTotalPaise: 30000, allocations: [{ userId: 'host', amountPaise: 30000 }] }],
    checkoutMode: 'HOST_PAYS', hostId: 'host', taxPaise: 1500,
  });
  assert.equal(result.memberShares.reduce((sum, row) => sum + row.amountPaise, 0), 31500);
  assert.deepEqual(result.contributions, [{ userId: 'host', amountPaise: 31500 }]);
});

test('invalid item shares and non-member allocations are rejected', () => {
  const base = { members: [{ userId: 'a' }, { userId: 'b' }], checkoutMode: 'SPLIT' };
  assert.throws(() => prepareGroupContributions({ ...base, items: [{ itemTotalPaise: 100, allocations: [{ userId: 'a', amountPaise: 99 }] }] }), /full item price/);
  assert.throws(() => prepareGroupContributions({ ...base, items: [{ itemTotalPaise: 100, allocations: [{ userId: 'outsider', amountPaise: 100 }] }] }), /active group member/);
});
