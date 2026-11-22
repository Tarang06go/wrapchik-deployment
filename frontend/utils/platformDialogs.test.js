import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmPlatformAction, runAfterPlatformConfirmation, showPlatformAlert } from './platformDialogs.js';

const createNativeAlert = () => {
  const calls = [];
  return { calls, alert: (...args) => calls.push(args) };
};

test('Android cash confirmation waits for Alert choice; cancel never runs the protected action', async () => {
  const native = createNativeAlert();
  const inFlight = new Set();
  let calls = 0;
  const run = runAfterPlatformConfirmation({
    key: 'order-1', inFlight, platform: 'android', title: 'Confirm Cash Payment', message: 'Cash received?',
    confirmLabel: 'Confirm Received', nativeAlert: native.alert, action: async () => { calls += 1; },
  });
  assert.equal(native.calls.length, 1);
  const [, , buttons, options] = native.calls[0];
  assert.equal(buttons[0].text, 'Cancel');
  assert.equal(buttons[1].text, 'Confirm Received');
  assert.equal(options.cancelable, true);
  buttons[0].onPress();
  assert.equal(await run, false);
  assert.equal(calls, 0);
});

test('iOS confirmation invokes the action once only after Confirm Received', async () => {
  const native = createNativeAlert();
  const inFlight = new Set();
  let calls = 0;
  const run = runAfterPlatformConfirmation({
    key: 'order-2', inFlight, platform: 'ios', title: 'Confirm Cash Payment', message: 'Cash received?',
    confirmLabel: 'Confirm Received', nativeAlert: native.alert, action: async () => { calls += 1; },
  });
  native.calls[0][2][1].onPress();
  assert.equal(await run, true);
  assert.equal(calls, 1);
});

test('web uses window.confirm only when it is a function and respects Cancel', async () => {
  const native = createNativeAlert();
  let calls = 0;
  const confirmed = await runAfterPlatformConfirmation({
    key: 'order-web', inFlight: new Set(), platform: 'web', title: 'Confirm', message: 'Cash received?',
    browserWindow: { confirm: () => false }, nativeAlert: native.alert, action: async () => { calls += 1; },
  });
  assert.equal(confirmed, false);
  assert.equal(calls, 0);
  assert.equal(native.calls.length, 0);
});

test('web confirmation submits once after approval and double taps are ignored while pending', async () => {
  const native = createNativeAlert();
  const inFlight = new Set();
  let releaseAction;
  let calls = 0;
  const action = () => { calls += 1; return new Promise(resolve => { releaseAction = resolve; }); };
  const options = { key: 'same-order', inFlight, platform: 'web', title: 'Confirm', message: 'Confirm?', browserWindow: { confirm: () => true }, nativeAlert: native.alert, action };
  const first = runAfterPlatformConfirmation(options);
  assert.equal(await runAfterPlatformConfirmation(options), false);
  assert.equal(calls, 1);
  releaseAction();
  assert.equal(await first, true);
});

test('missing web confirm falls back to native Alert and dismissal is cancellation', async () => {
  const native = createNativeAlert();
  const confirmation = confirmPlatformAction({ platform: 'web', title: 'Confirm', message: 'Proceed?', browserWindow: {}, nativeAlert: native.alert });
  assert.equal(native.calls.length, 1);
  native.calls[0][3].onDismiss();
  assert.equal(await confirmation, false);
});

test('browser alert falls back safely when unavailable', () => {
  const native = createNativeAlert();
  showPlatformAlert('web', 'Problem', 'Try again', { browserWindow: {}, nativeAlert: native.alert });
  assert.deepEqual(native.calls[0].slice(0, 2), ['Problem', 'Try again']);
});
