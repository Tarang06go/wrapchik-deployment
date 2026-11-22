import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../services/apiEndpoint.js', import.meta.url), 'utf8')
  .replace(/\bexport const\b/g, 'const');
const endpoint = new Function(`${source}\nreturn { resolveApiBaseUrl, toSocketBaseUrl };`)();

test('release API resolution requires a public HTTPS endpoint', () => {
  const valid = endpoint.resolveApiBaseUrl({ configuredUrl: 'https://api.wrapchik.in', platform: 'android', development: false });
  assert.equal(valid.baseUrl, 'https://api.wrapchik.in/api');
  assert.equal(valid.error, null);

  for (const configuredUrl of ['http://api.wrapchik.in', 'https://192.168.1.10', 'https://10.20.0.5', 'https://172.18.0.3', 'https://169.254.4.2', 'https://0.0.0.0', 'https://wrapchik.local']) {
    const result = endpoint.resolveApiBaseUrl({ configuredUrl, platform: 'android', development: false });
    assert.equal(result.baseUrl, null, configuredUrl);
    assert.match(result.error, /public HTTPS/i);
  }
});

test('development still supports a phone-accessible LAN API without a source-code IP', () => {
  const result = endpoint.resolveApiBaseUrl({ configuredUrl: 'http://192.168.1.10:5000', platform: 'android', development: true });
  assert.equal(result.baseUrl, 'http://192.168.1.10:5000/api');
  assert.equal(result.error, null);
});
