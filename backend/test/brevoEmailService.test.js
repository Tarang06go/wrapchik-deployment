const test = require('node:test');
const assert = require('node:assert/strict');
const { createBrevoEmailService } = require('../src/services/brevoEmailService');
const { getEmailDeliveryProvider } = require('../src/utils/emailProviderConfig');

test('Brevo sends branded OTPs through the transactional HTTPS API', async () => {
  let request;
  const service = createBrevoEmailService({
    getEnv: () => ({ BREVO_API_KEY: '  test-api-key\n', BREVO_EMAIL_FROM: ' wrapchik.admin@gmail.com ' }),
    fetchImpl: async (...args) => {
      request = args;
      return { ok: true, status: 201, json: async () => ({ messageId: 'brevo-message-id' }) };
    },
  });

  const result = await service.sendOtpEmail({ to: 'student@thapar.edu', code: '123456', purpose: 'SIGNUP' });
  assert.deepEqual(result, { id: 'brevo-message-id' });
  assert.equal(request[0], 'https://api.brevo.com/v3/smtp/email');
  assert.equal(request[1].method, 'POST');
  assert.equal(request[1].headers['api-key'], 'test-api-key');
  const payload = JSON.parse(request[1].body);
  assert.deepEqual(payload.sender, { name: 'Wrapchik', email: 'wrapchik.admin@gmail.com' });
  assert.deepEqual(payload.to, [{ email: 'student@thapar.edu' }]);
  assert.match(payload.htmlContent, /123456/);
  assert.equal(payload.textContent, undefined);
});

test('Brevo delivery errors are generic and logs do not include recipient, API key, or OTP', async () => {
  const originalWarn = console.warn;
  let logs = '';
  console.warn = (...args) => { logs += args.map((arg) => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' '); };
  try {
    const service = createBrevoEmailService({
      getEnv: () => ({ BREVO_API_KEY: 'private-api-key', BREVO_EMAIL_FROM: 'sender@gmail.com' }),
      fetchImpl: async () => ({
        ok: false,
        status: 401,
        json: async () => ({
          code: 'unauthorized',
          message: 'Invalid api-key=private-api-key for student@thapar.edu; xkeysib-LeakedCredential OTP 123456 phone +1 555 123 4567',
        }),
      }),
    });
    await assert.rejects(service.sendOtpEmail({ to: 'student@thapar.edu', code: '123456', purpose: 'SIGNUP' }), (error) => {
      assert.equal(error.statusCode, 502);
      assert.equal(error.message, 'The email provider could not accept the verification email.');
      return true;
    });
  } finally {
    console.warn = originalWarn;
  }
  assert.match(logs, /status["']?:?\s*401/);
  assert.match(logs, /unauthorized/);
  assert.match(logs, /redacted email/);
  assert.doesNotMatch(logs, /student@thapar\.edu|private-api-key|xkeysib-LeakedCredential|123456|555 123 4567/);
});

test('email provider selection shares one gate and does not use SMTP in production', () => {
  assert.equal(getEmailDeliveryProvider({ NODE_ENV: 'production', SMTP_USER: 'sender@gmail.com', SMTP_APP_PASSWORD: 'secret' }), null);
  assert.equal(getEmailDeliveryProvider({ NODE_ENV: 'development', SMTP_USER: 'sender@gmail.com', SMTP_APP_PASSWORD: 'secret' }), 'gmail');
  assert.equal(getEmailDeliveryProvider({ NODE_ENV: 'production', BREVO_API_KEY: 'key', BREVO_EMAIL_FROM: 'sender@gmail.com' }), 'brevo');
  assert.equal(getEmailDeliveryProvider({ NODE_ENV: 'production', RESEND_API_KEY: 'key', EMAIL_FROM: 'Wrapchik <onboarding@resend.dev>' }), null);
  assert.equal(getEmailDeliveryProvider({ NODE_ENV: 'production', RESEND_API_KEY: 'key', EMAIL_FROM: 'Wrapchik <auth@verified.example>' }), 'resend');
});

