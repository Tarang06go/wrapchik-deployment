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
const createGroupPickupToken = (orderId, groupOrderId, expiresAt, secret) => {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('A strong server signing secret is required for pickup QR tokens.');
  const exp = Math.floor(new Date(expiresAt).getTime() / 1000);
  // Domain-separated deterministic nonce lets every active group member retrieve the
  // same QR while the database continues to store only its one-way hash.
  const nonce = crypto.createHmac('sha256', secret)
    .update(`wrapchik:group-pickup:${String(groupOrderId)}:${String(orderId)}:${exp}`)
    .digest().subarray(0, 24).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ orderId: String(orderId), groupOrderId: String(groupOrderId), exp, nonce })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};
const hashPickupToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const isValidPickupToken = (token) => typeof token === 'string' && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token);
const getVerifiedPickupTokenClaims = (token, { now = Date.now(), secret } = {}) => {
  if (!isValidPickupToken(token) || typeof secret !== 'string' || secret.length < 32) return null;
  const [payload, signature] = token.split('.');
  const expected = Buffer.from(crypto.createHmac('sha256', secret).update(payload).digest('base64url'));
  const provided = Buffer.from(signature);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.orderId !== 'string' || !Number.isInteger(data.exp) || data.exp * 1000 <= now
      || typeof data.nonce !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(data.nonce)) return null;
    if (data.groupOrderId !== undefined && (typeof data.groupOrderId !== 'string' || !/^[a-f\d]{24}$/i.test(data.groupOrderId))) return null;
    return data;
  } catch (_) { return null; }
};
const verifyPickupToken = (token, options = {}) => {
  const { orderId, groupOrderId, now = Date.now(), secret } = options;
  const claims = getVerifiedPickupTokenClaims(token, { now, secret });
  if (!claims || claims.orderId !== String(orderId)) return false;
  if (Object.prototype.hasOwnProperty.call(options, 'groupOrderId')) {
    if (groupOrderId == null ? claims.groupOrderId !== undefined : claims.groupOrderId !== String(groupOrderId)) return false;
  }
  return true;
};

module.exports = { createPickupToken, createGroupPickupToken, hashPickupToken, isValidPickupToken, getVerifiedPickupTokenClaims, verifyPickupToken };
