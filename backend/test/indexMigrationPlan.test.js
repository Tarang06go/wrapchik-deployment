const test = require('node:test');
const assert = require('node:assert/strict');
const { planIndexMigration } = require('../src/utils/indexMigrationPlan');

test('feature index migration recognizes every existing index as complete', () => {
  const existing = [
    { name: '_id_', key: { _id: 1 } },
    { name: 'ledger_once', key: { orderId: 1, type: 1 }, unique: true },
    { name: 'ledger_history', key: { userId: 1, createdAt: -1 } },
    { name: 'review_once', key: { orderId: 1, userId: 1 }, unique: true },
    { name: 'review_history', key: { createdAt: -1 } },
  ];
  const desired = [
    { keys: { orderId: 1, type: 1 }, options: { unique: true, name: 'expected-ledger-name' } },
    { keys: { userId: 1, createdAt: -1 }, options: { name: 'expected-history-name' } },
    { keys: { orderId: 1, userId: 1 }, options: { unique: true, name: 'expected-review-name' } },
    { keys: { createdAt: -1 }, options: { name: 'expected-review-history' } },
  ];
  assert.deepEqual(planIndexMigration(existing, desired), []);
});

test('feature index migration plans only indexes that are missing', () => {
  const desired = [
    { keys: { orderId: 1, type: 1 }, options: { unique: true } },
    { keys: { userId: 1, createdAt: -1 }, options: {} },
  ];
  assert.deepEqual(planIndexMigration([{ key: { orderId: 1, type: 1 }, unique: true }], desired), [desired[1]]);
});

test('feature index migration aborts on an incompatible same-key index', () => {
  assert.throws(() => planIndexMigration(
    [{ name: 'nonunique_ledger', key: { orderId: 1, type: 1 }, unique: false }],
    [{ keys: { orderId: 1, type: 1 }, options: { unique: true } }],
  ), /incompatible unique options/);
});
