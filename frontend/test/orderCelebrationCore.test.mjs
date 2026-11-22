import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldCelebrateOrderPlacement } from '../utils/orderCelebrationCore.js';

test('a newly placed, live order can receive the brief celebration', () => {
  assert.equal(shouldCelebrateOrderPlacement(true, { orderStatus: 'PLACED', paymentMethod: 'COUNTER', paymentStatus: 'PENDING' }), true);
  assert.equal(shouldCelebrateOrderPlacement(true, { orderStatus: 'READY', paymentMethod: 'UPI_QR', paymentStatus: 'SUCCESS' }), true);
  assert.equal(shouldCelebrateOrderPlacement(true, { orderStatus: 'PLACED', paymentMethod: 'UPI_QR', paymentStatus: 'PENDING' }), false);
  assert.equal(shouldCelebrateOrderPlacement(true, { orderStatus: 'PLACED', paymentMethod: 'UPI_QR', paymentStatus: 'FAILED' }), false);
});

test('ordinary history visits and declined orders do not celebrate', () => {
  assert.equal(shouldCelebrateOrderPlacement(false, { orderStatus: 'PLACED', paymentMethod: 'COUNTER' }), false);
  assert.equal(shouldCelebrateOrderPlacement(true, { orderStatus: 'CANCELLED', paymentMethod: 'COUNTER' }), false);
  assert.equal(shouldCelebrateOrderPlacement(true, { orderStatus: 'REJECTED', paymentMethod: 'COUNTER' }), false);
  assert.equal(shouldCelebrateOrderPlacement(true, 'PLACED'), false);
});
