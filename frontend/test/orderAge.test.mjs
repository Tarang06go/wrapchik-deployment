import test from 'node:test';
import assert from 'node:assert/strict';
import { isOrderOverdue, orderAgeMinutes } from '../utils/orderAge.js';

test('order age is bounded at zero and rejects invalid timestamps', () => {
  assert.equal(orderAgeMinutes('2026-11-20T10:00:00Z', new Date('2026-11-20T10:29:59Z')), 29);
  assert.equal(orderAgeMinutes('2026-11-20T11:00:00Z', new Date('2026-11-20T10:00:00Z')), 0);
  assert.equal(orderAgeMinutes('not-a-date', Date.now()), null);
});

test('only active kitchen orders become overdue at the configured threshold', () => {
  const createdAt = '2026-11-20T10:00:00Z';
  const now = new Date('2026-11-20T10:30:00Z');
  assert.equal(isOrderOverdue({ createdAt, orderStatus: 'PLACED' }, 30, now), true);
  assert.equal(isOrderOverdue({ createdAt, orderStatus: 'ACCEPTED' }, 30, now), true);
  assert.equal(isOrderOverdue({ createdAt, orderStatus: 'COMPLETED' }, 30, now), false);
  assert.equal(isOrderOverdue({ createdAt, orderStatus: 'PLACED' }, 0, now), false);
});
