const test = require('node:test');
const assert = require('node:assert/strict');
const { LEGACY_PICKUP_LOCATION, resolvePickupLocation } = require('../src/utils/pickupLocation');

test('pickup order snapshots use configured admin location rather than a client-provided destination', () => {
  assert.equal(resolvePickupLocation('SAC Ground Floor, TIET'), 'SAC Ground Floor, TIET');
});

test('unset pickup point preserves the legacy TIET counter address for compatibility', () => {
  assert.equal(resolvePickupLocation(''), LEGACY_PICKUP_LOCATION);
  assert.equal(resolvePickupLocation(undefined), LEGACY_PICKUP_LOCATION);
});
