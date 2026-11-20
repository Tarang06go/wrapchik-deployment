import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePickupQrPayload } from '../utils/pickupQrPayload.js';

test('pickup QR parser accepts only the app-owned signed pickup deep link', () => {
  const orderId = '64b000000000000000000001';
  const token = `${'a'.repeat(120)}.${'b'.repeat(43)}`;
  const uri = `wrapchik://admin/pickup?orderId=${orderId}&token=${encodeURIComponent(token)}`;
  assert.deepEqual(parsePickupQrPayload(uri), { orderId, token });
});

test('pickup QR parser rejects website URLs, unrelated app routes and malformed identifiers', () => {
  assert.equal(parsePickupQrPayload('https://example.com?orderId=64b000000000000000000001'), null);
  assert.equal(parsePickupQrPayload('wrapchik://admin/orders?orderId=64b000000000000000000001'), null);
  assert.equal(parsePickupQrPayload('wrapchik://admin/pickup?orderId=bad&token=bad'), null);
  assert.equal(parsePickupQrPayload('x'.repeat(5000)), null);
});
