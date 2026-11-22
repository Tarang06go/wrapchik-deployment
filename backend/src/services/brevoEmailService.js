const purposeCopy = {
  SIGNUP: { subject: 'Verify your Wrapchik student account', heading: 'Create your Wrapchik account' },
  LOGIN: { subject: 'Your Wrapchik sign-in code', heading: 'Sign in to Wrapchik' },
  EMAIL_VERIFY: { subject: 'Verify your Wrapchik email', heading: 'Verify your email' },
  PASSWORD_RESET: { subject: 'Reset your Wrapchik password', heading: 'Reset your password' },
};

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const createBrevoEmailService = ({ fetchImpl = globalThis.fetch, getEnv = () => process.env } = {}) => {
  const sendOtpEmail = async ({ to, code, purpose }) => {
    const env = getEnv();
    if (!env.BREVO_API_KEY || !env.BREVO_EMAIL_FROM) {
      const error = new Error('Email verification is temporarily unavailable. Please try again later.');
      error.statusCode = 503;
      throw error;
    }
    if (typeof fetchImpl !== 'function') {
      const error = new Error('Email verification is temporarily unavailable. Please try again later.');
      error.statusCode = 503;
      throw error;
    }

    const copy = purposeCopy[purpose] || purposeCopy.LOGIN;
    const safeCode = escapeHtml(code);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    timeout.unref?.();
    try {
      const response = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': env.BREVO_API_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'Wrapchik', email: env.BREVO_EMAIL_FROM },
          to: [{ email: to }],
          subject: copy.subject,
          htmlContent: `<!doctype html><html><body style="margin:0;background:#fff8f3;font-family:Arial,sans-serif;color:#242b37"><div style="max-width:520px;margin:32px auto;padding:28px;background:#fff;border:1px solid #f0e5de;border-radius:18px"><div style="display:inline-block;background:#ff5722;color:#fff;border-radius:14px;padding:10px 14px;font-size:22px;font-weight:800">W</div><p style="color:#ff5722;font-size:12px;font-weight:800;letter-spacing:2px">WRAPCHIK</p><h1 style="font-size:24px">${copy.heading}</h1><p>Use this one-time verification code:</p><p style="display:inline-block;background:#fff2eb;border-radius:12px;padding:14px 20px;color:#ff5722;font-size:30px;font-weight:800;letter-spacing:8px">${safeCode}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p><p style="color:#697386;font-size:12px">For your security, do not share this code with anyone.</p></div></body></html>`,
        }),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.messageId) {
        console.warn('[Brevo OTP] Provider rejected verification email', { status: response.status });
        const error = new Error('The email provider could not accept the verification email.');
        error.statusCode = response.status === 429 ? 429 : 502;
        throw error;
      }
      console.info('[Brevo OTP] Provider accepted verification email', { purpose });
      return { id: String(body.messageId).slice(0, 200) };
    } catch (error) {
      if (error.statusCode) throw error;
      console.warn('[Brevo OTP] Delivery request failed', {
        reason: error?.name === 'AbortError' ? 'timeout' : 'network_error',
      });
      const deliveryError = new Error('The email provider could not accept the verification email.');
      deliveryError.statusCode = 502;
      throw deliveryError;
    } finally {
      clearTimeout(timeout);
    }
  };

  return { sendOtpEmail };
};

module.exports = { createBrevoEmailService };
