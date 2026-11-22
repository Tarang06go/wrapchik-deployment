import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  getAvailableCheckoutMethods,
  confirmWebUpiRetrySynchronously,
  isValidUpiTransactionReference,
  launchUpiPayment,
  reconcileCheckoutMethod,
  selectCheckoutMethod,
} from '../utils/paymentClientLogic.mjs';

const bothEnabled = { cashEnabled: true, upiEnabled: true, upiId: 'wrapchik@upi', upiPayeeName: 'Wrapchik' };

test('cash and UPI remain reversible for repeated web and native selection', () => {
  for (const platform of ['web', 'ios', 'android']) {
    let selected = 'COUNTER';
    for (let index = 0; index < 4; index += 1) {
      selected = selectCheckoutMethod(selected, 'UPI_QR', bothEnabled);
      assert.equal(selected, 'UPI_QR', `${platform}: UPI selection`);
      selected = selectCheckoutMethod(selected, 'COUNTER', bothEnabled);
      assert.equal(selected, 'COUNTER', `${platform}: cash selection`);
    }
  }
});

test('payment selection respects settings and falls back only when the selected method is disabled', () => {
  const cashOnly = { cashEnabled: true, upiEnabled: false, upiId: 'wrapchik@upi', upiPayeeName: 'Wrapchik' };
  const upiOnly = { ...bothEnabled, cashEnabled: false };
  assert.deepEqual(getAvailableCheckoutMethods(bothEnabled), ['COUNTER', 'UPI_QR']);
  assert.equal(selectCheckoutMethod('UPI_QR', 'UPI_QR', cashOnly), 'COUNTER');
  assert.equal(reconcileCheckoutMethod('COUNTER', upiOnly), 'UPI_QR');
  assert.equal(reconcileCheckoutMethod('', { cashEnabled: false, upiEnabled: false }), '');
});

test('UPI reference validation matches the backend length and character rules', () => {
  assert.equal(isValidUpiTransactionReference('12345678'), true);
  assert.equal(isValidUpiTransactionReference('AbC-1234-xyz'), true);
  assert.equal(isValidUpiTransactionReference('  12345678  '), true);
  assert.equal(isValidUpiTransactionReference('1234567'), false);
  assert.equal(isValidUpiTransactionReference('12345678/'), false);
  assert.equal(isValidUpiTransactionReference('x'.repeat(121)), false);
});

test('web UPI handoff opens a new browsing context only when invoked and handles popup blocking', async () => {
  const calls = [];
  await launchUpiPayment({ platform: 'web', uri: 'upi://pay?pa=wrapchik%40upi', browserWindow: { open: (...args) => { calls.push(args); return {}; } } });
  assert.deepEqual(calls, [['upi://pay?pa=wrapchik%40upi', '_blank']]);
  await assert.rejects(launchUpiPayment({ platform: 'web', uri: 'upi://pay?pa=x', browserWindow: { open: () => null } }), /blocked/);
});

test('repeat web payment handoff requires an explicit synchronous confirmation', () => {
  const calls = [];
  assert.equal(confirmWebUpiRetrySynchronously({ confirm: message => { calls.push(message); return true; } }, 'Check first'), true);
  assert.equal(confirmWebUpiRetrySynchronously({ confirm: () => false }, 'Check first'), false);
  assert.equal(confirmWebUpiRetrySynchronously({}, 'Check first'), false);
  assert.deepEqual(calls, ['Check first']);
});

test('native UPI handoff delegates to the system URL handler and remains an explicit UI action', async () => {
  const calls = [];
  await launchUpiPayment({ platform: 'ios', uri: 'upi://pay?pa=wrapchik%40upi', linking: { openURL: async uri => calls.push(uri) } });
  assert.deepEqual(calls, ['upi://pay?pa=wrapchik%40upi']);
  const paymentScreen = fs.readFileSync(new URL('../app/payment.jsx', import.meta.url), 'utf8');
  assert.match(paymentScreen, /onPress=\{openUpiApp\}/);
  assert.doesNotMatch(paymentScreen, /autoLaunchAttemptedUri/);
});

test('payment screen refreshes canonical order state after matching socket events and app resume', () => {
  const paymentScreen = fs.readFileSync(new URL('../app/payment.jsx', import.meta.url), 'utf8');
  assert.match(paymentScreen, /socket\.on\('order_updated'/);
  assert.match(paymentScreen, /socket\.on\('connect'/);
  assert.match(paymentScreen, /socket\.on\('refresh_authoritative_state'/);
  assert.match(paymentScreen, /orderService\.getOrderById\(orderId\)/);
  assert.match(paymentScreen, /AppState\.addEventListener\('change'/);
  assert.doesNotMatch(paymentScreen, /setOrder\([^)]*paymentStatus\s*:\s*['"]SUCCESS/);
});

test('verified order confirmation shows the saved UPI receipt reference only for successful UPI payments', () => {
  const confirmation = fs.readFileSync(new URL('../app/order-confirmation.jsx', import.meta.url), 'utf8');
  assert.match(confirmation, /order\.paymentStatus === 'SUCCESS'[\s\S]*?order\.paymentMethod === 'UPI_QR'[\s\S]*?upiTransactionReference/);
});
