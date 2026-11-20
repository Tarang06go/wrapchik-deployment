const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Challenge = require('../src/models/GoogleLoginChallenge');
const { googleChallenge } = require('../src/controllers/googleAuthController');

test('Google challenge returns the SHA-256 hex nonce and stores only its hash', async () => {
  const originalCreate = Challenge.create;
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  const originalRandomBytes = crypto.randomBytes;
  const randomSeed = Buffer.alloc(32, 0x6a);
  let storedChallenge;
  process.env.GOOGLE_CLIENT_ID = 'wrapchik-web-client.apps.googleusercontent.com';
  crypto.randomBytes = () => randomSeed;
  Challenge.create = async (payload) => {
    storedChallenge = payload;
    return { _id: '64b000000000000000000001' };
  };

  try {
    const res = {
      statusCode: 200,
      headers: {},
      set(name, value) { this.headers[name] = value; return this; },
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await googleChallenge({}, res, (error) => { throw error; });

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Cache-Control'], 'no-store');
    const expectedNonce = crypto.createHash('sha256').update(randomSeed).digest('hex');
    assert.equal(res.body.nonce, expectedNonce);
    assert.equal(storedChallenge.nonceHash, crypto.createHash('sha256').update(res.body.nonce).digest('hex'));
    assert.equal(storedChallenge.expiresAt.getTime() - Date.now() <= 5 * 60 * 1000, true);
    assert.equal(Object.hasOwn(storedChallenge, 'nonce'), false);
  } finally {
    Challenge.create = originalCreate;
    crypto.randomBytes = originalRandomBytes;
    if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = originalClientId;
  }
});
