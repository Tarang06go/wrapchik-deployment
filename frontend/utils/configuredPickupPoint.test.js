import test from 'node:test';
import assert from 'node:assert/strict';
import { getConfiguredPickupPoint } from './configuredPickupPoint.js';

test('campus pickup point stays hidden until an admin configures a non-empty address', () => {
  assert.equal(getConfiguredPickupPoint(null), '');
  assert.equal(getConfiguredPickupPoint({ pickupLocation: '   ' }), '');
  assert.equal(getConfiguredPickupPoint({ pickupLocation: '  SAC Ground Floor, TIET  ' }), 'SAC Ground Floor, TIET');
});
