const SMTP_ENABLED_IN_DEVELOPMENT = (env) => env.NODE_ENV !== 'production'
  && Boolean(env.SMTP_USER && env.SMTP_APP_PASSWORD);

const emailAddress = (value) => {
  const input = String(value || '').trim();
  const displayNameMatch = input.match(/<([^<>]+)>\s*$/);
  const address = (displayNameMatch ? displayNameMatch[1] : input).trim();
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address) ? address : '';
};

const getEmailDeliveryProvider = (env = process.env) => {
  // SMTP remains available to local development. Render Free does not relay SMTP.
  if (SMTP_ENABLED_IN_DEVELOPMENT(env)) return 'gmail';

  if (env.BREVO_API_KEY && emailAddress(env.BREVO_EMAIL_FROM)) return 'brevo';

  const resendSender = emailAddress(env.EMAIL_FROM);
  if (env.RESEND_API_KEY && resendSender && !/@resend\.dev$/i.test(resendSender)) return 'resend';

  return null;
};

module.exports = { emailAddress, getEmailDeliveryProvider };
