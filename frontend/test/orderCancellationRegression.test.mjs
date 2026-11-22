import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const tracking = fs.readFileSync(new URL('../app/order-tracking/[id].jsx', import.meta.url), 'utf8');

test('order tracking uses a cross-platform explicit confirmation before calling cancellation API', () => {
  assert.match(tracking, /runAfterPlatformConfirmation\(/);
  assert.match(tracking, /browserWindow: Platform\.OS === 'web'[\s\S]*?window/);
  assert.match(tracking, /nativeAlert: \(\.\.\.args\) => Alert\.alert\(\.\.\.args\)/);
  assert.match(tracking, /action: performCancel/);
  assert.match(tracking, /orderService\.cancelOrder\(order\._id\)/);
  assert.match(tracking, /cancelConfirmationInFlightRef/);
});

test('tracking exposes cancellation only for placed unpaid orders and leaves paid orders to support', () => {
  assert.match(tracking, /order\.orderStatus === 'PLACED' && order\.paymentStatus !== 'SUCCESS'/);
  assert.match(tracking, /order\.orderStatus === 'PLACED' && order\.paymentStatus === 'SUCCESS'/);
  assert.match(tracking, /refunds are not available in the current workflow/);
});
