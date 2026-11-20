import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldCelebrateOrderPlacement } from '../utils/orderCelebrationCore.js';

test('a newly placed, live order can receive the brief celebration', () => {
  assert.equal(shouldCelebrateOrderPlacement(true, 'PLACED'), true);
  assert.equal(shouldCelebrateOrderPlacement(true, 'READY'), true);
});

test('ordinary history visits and declined orders do not celebrate', () => {
  assert.equal(shouldCelebrateOrderPlacement(false, 'PLACED'), false);
  assert.equal(shouldCelebrateOrderPlacement(true, 'CANCELLED'), false);
  assert.equal(shouldCelebrateOrderPlacement(true, 'REJECTED'), false);
});
