const test = require('node:test');
const assert = require('node:assert/strict');
const Order = require('../src/models/Order');
const { createPickupToken, hashPickupToken, isValidPickupToken, verifyPickupToken } = require('../src/utils/pickupToken');

test('pickup tokens are high-entropy opaque values and are stored as hashes only', () => {
  const secret = 'pickup-test-secret-with-more-than-thirty-two-characters';
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const token = createPickupToken('order-id', expiresAt, secret);
  const hash = hashPickupToken(token);
  assert.equal(isValidPickupToken(token), true);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, token);
  assert.equal(verifyPickupToken(token, { orderId: 'order-id', secret }), true);
  assert.equal(verifyPickupToken(token, { orderId: 'other-order', secret }), false);
  assert.equal(verifyPickupToken(`${token.slice(0, -1)}x`, { orderId: 'order-id', secret }), false);
  assert.equal(verifyPickupToken(token, { orderId: 'order-id', secret, now: expiresAt.getTime() + 1000 }), false);
  assert.equal(isValidPickupToken('short'), false);
  assert.equal(Order.schema.path('pickupTokenHash').options.select, false);
  assert.equal(Order.schema.path('pickupTokenExpiresAt').options.select, false);
  assert.equal(Order.schema.path('pickupVerifiedBy').options.ref, 'User');
});
