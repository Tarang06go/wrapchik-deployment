const crypto = require('crypto');

const createPickupToken = (orderId, expiresAt, secret) => {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('A strong server signing secret is required for pickup QR tokens.');
  const payload = Buffer.from(JSON.stringify({
    orderId: String(orderId),
    exp: Math.floor(new Date(expiresAt).getTime() / 1000),
    nonce: crypto.randomBytes(24).toString('base64url'),
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};
const hashPickupToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const isValidPickupToken = (token) => typeof token === 'string' && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token);
const verifyPickupToken = (token, { orderId, now = Date.now(), secret } = {}) => {
  if (!isValidPickupToken(token) || typeof secret !== 'string' || secret.length < 32) return false;
  const [payload, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest();
  const provided = Buffer.from(signature, 'base64url');
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.orderId === String(orderId) && Number.isInteger(data.exp) && data.exp * 1000 > now
      && typeof data.nonce === 'string' && /^[A-Za-z0-9_-]{32}$/.test(data.nonce);
  } catch (_) { return false; }
};

module.exports = { createPickupToken, hashPickupToken, isValidPickupToken, verifyPickupToken };
