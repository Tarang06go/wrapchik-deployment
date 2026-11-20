const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const validator = path.join(__dirname, '..', 'scripts', 'validate-api-url.cjs');

const runValidation = ({ profile = 'preview', apiUrl } = {}) => {
  const env = { ...process.env, EAS_BUILD_PROFILE: '' };
  if (apiUrl === undefined) delete env.EXPO_PUBLIC_API_URL;
  else env.EXPO_PUBLIC_API_URL = apiUrl;
  return spawnSync(process.execPath, [validator, '--profile', profile], { encoding: 'utf8', env });
};

test('EAS preview and production profiles accept HTTPS backend URLs', () => {
  for (const profile of ['preview', 'production']) {
    const result = runValidation({ profile, apiUrl: 'https://api.wrapchik.in/api' });
    assert.equal(result.status, 0, result.stderr);
  }
});

test('EAS release profiles reject missing, placeholder, local, and non-HTTPS URLs', () => {
  const invalidUrls = [
    undefined,
    'https://your-wrapchik-backend.example.com',
    'http://api.wrapchik.in',
    'https://localhost:5000',
    'https://10.0.2.2:5000',
    'https://api.wrapchik.in/path',
  ];

  for (const apiUrl of invalidUrls) {
    const result = runValidation({ profile: 'preview', apiUrl });
    assert.notEqual(result.status, 0, `Expected rejection for ${apiUrl}`);
  }
});

test('development profile does not require a deployed HTTPS backend', () => {
  const result = runValidation({ profile: 'development', apiUrl: 'http://localhost:5000' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /skipped/i);
});
