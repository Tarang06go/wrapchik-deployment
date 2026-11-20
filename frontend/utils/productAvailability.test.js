import test from 'node:test';
import assert from 'node:assert/strict';
import { isProductAvailable } from './productAvailability.js';

test('unlimited stock (null or missing) remains available', () => {
  assert.equal(isProductAvailable({ available: true, stock: null }), true);
  assert.equal(isProductAvailable({ available: true }), true);
});

test('finite stock is unavailable only at zero or below', () => {
  assert.equal(isProductAvailable({ available: true, stock: 3 }), true);
  assert.equal(isProductAvailable({ available: true, stock: '1' }), true);
  assert.equal(isProductAvailable({ available: true, stock: 0 }), false);
  assert.equal(isProductAvailable({ available: true, stock: -1 }), false);
});

test('an explicitly unavailable product stays unavailable', () => {
  assert.equal(isProductAvailable({ available: false, stock: null }), false);
});
