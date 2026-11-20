const test = require('node:test');
const assert = require('node:assert/strict');
const { allocatePaise, equalAllocations, acceptancesComplete } = require('../src/utils/groupItemAllocation');

test('equal shared-dish allocation assigns rounding paise deterministically and totals exactly', () => {
  const shares = equalAllocations(['b', 'a', 'c']);
  const first = allocatePaise(10001, shares);
  const second = allocatePaise(10001, shares);

  assert.deepEqual(first, second);
  assert.equal(first.reduce((sum, share) => sum + share.amountPaise, 0), 10001);
  assert.deepEqual(first.map((share) => share.amountPaise), [3335, 3333, 3333]);
});

test('custom basis-point shares allocate large paise totals without floating point drift', () => {
  const result = allocatePaise(Number.MAX_SAFE_INTEGER, [
    { userId: 'student-b', percentageBps: 3333 },
    { userId: 'student-a', percentageBps: 6667 },
  ]);
  assert.equal(result.reduce((sum, row) => sum + row.amountPaise, 0), Number.MAX_SAFE_INTEGER);
});

test('allocation rejects incomplete shares and duplicate members', () => {
  assert.throws(() => allocatePaise(100, [
    { userId: 'a', percentageBps: 5000 }, { userId: 'b', percentageBps: 4999 },
  ]), /100%/);
  assert.throws(() => allocatePaise(100, [
    { userId: 'a', percentageBps: 5000 }, { userId: 'a', percentageBps: 5000 },
  ]), /once/);
});

test('all participants must accept the current item revision before locking', () => {
  const item = {
    revision: 3,
    allocations: [
      { acceptedRevision: 3, acceptedAt: new Date() },
      { acceptedRevision: 2, acceptedAt: new Date() },
    ],
  };
  assert.equal(acceptancesComplete(item), false);
  item.allocations[1].acceptedRevision = 3;
  assert.equal(acceptancesComplete(item), true);
});
