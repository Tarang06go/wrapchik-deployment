import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const payment = fs.readFileSync(new URL('../app/payment.jsx', import.meta.url), 'utf8');

test('UPI launch uses backend instructions and does not set payment success locally', () => {
  assert.match(payment, /paymentService\.getUpiInstructions\(orderId\)/);
  assert.match(payment, /await Linking\.openURL\(instructions\.upiUri\)/);
  assert.match(payment, /currentOrder\.paymentStatus === 'SUCCESS'/);
  assert.doesNotMatch(payment, /paymentStatus\s*=\s*['"]SUCCESS['"]/);
});

test('UPI app launch failures preserve the QR and manual-verification fallback', () => {
  assert.match(payment, /setUpiAppUnavailable\(true\)/);
  assert.match(payment, /<QRCode value=\{instructions\.upiUri\}/);
  assert.match(payment, /submitUpiReference\(orderId, reference\)/);
});

test('UPI fallback copies the backend order link and blocks overlapping launch/reference actions', () => {
  assert.match(payment, /Clipboard\.setStringAsync\(instructions\.upiUri\)/);
  assert.match(payment, /hasPendingReference[\s\S]*?Do not pay again/);
  assert.match(payment, /AppState\.addEventListener\('change'/);
  assert.match(payment, /upiLaunchInFlight\.current/);
  assert.match(payment, /referenceSubmitInFlight\.current/);
  assert.match(payment, /Copy order-specific UPI link/);
});
