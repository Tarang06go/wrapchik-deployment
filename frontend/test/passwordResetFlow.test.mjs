import test from 'node:test';
import assert from 'node:assert/strict';
import { canSendPasswordResetCode, normalizePasswordResetSend } from '../utils/passwordResetFlowCore.js';

test('a successful password-reset OTP response advances to verification with server timing', () => {
  const outcome = normalizePasswordResetSend({
    success: true,
    message: 'If an account matches this email, check its inbox for a recovery code.',
    resendAfterSeconds: 45,
    expiresInSeconds: 480,
  });
  assert.equal(outcome.success, true);
  assert.equal(outcome.resendAfterSeconds, 45);
  assert.equal(outcome.expiresInSeconds, 480);
  assert.match(outcome.message, /check its inbox/);
});

test('failed password-reset responses remain actionable errors', () => {
  assert.deepEqual(normalizePasswordResetSend({ success: false, message: 'Email delivery failed.' }), {
    success: false,
    message: 'Email delivery failed.',
  });
  assert.equal(normalizePasswordResetSend(null).success, false);
});

test('recovery-code sends are blocked while in flight or during resend cooldown', () => {
  assert.equal(canSendPasswordResetCode(false, 0), true);
  assert.equal(canSendPasswordResetCode(true, 0), false);
  assert.equal(canSendPasswordResetCode(false, 1), false);
});
