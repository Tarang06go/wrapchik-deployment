const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

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
    'https://192.168.1.10:5000',
    'https://172.20.4.5:5000',
    'https://169.254.2.10:5000',
    'https://api.wrapchik.in/path',
  ];

  for (const apiUrl of invalidUrls) {
    const result = runValidation({ profile: 'preview', apiUrl });
    assert.notEqual(result.status, 0, `Expected rejection for ${apiUrl}`);
  }
});

test('EAS release profiles reject literal private and link-local backend addresses', () => {
  for (const apiUrl of ['https://10.5.0.7', 'https://172.31.4.8', 'https://192.168.0.25', 'https://169.254.1.2', 'https://0.0.0.0', 'https://[fc00::1]', 'https://wrapchik.local']) {
    const result = runValidation({ profile: 'production', apiUrl });
    assert.notEqual(result.status, 0, `Expected private host rejection for ${apiUrl}`);
  }
});

test('development profile does not require a deployed HTTPS backend', () => {
  const result = runValidation({ profile: 'development', apiUrl: 'http://localhost:5000' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /skipped/i);
});

test('validator can preflight an EAS-pulled environment file without echoing its URL', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wrapchik-eas-env-'));
  const envFile = path.join(directory, 'environment');
  try {
    fs.writeFileSync(envFile, 'EXPO_PUBLIC_API_URL=https://api.wrapchik.in/api\n');
    const result = spawnSync(process.execPath, [validator, '--profile', 'preview', '--env-file', envFile], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /valid for EAS preview/i);
    assert.doesNotMatch(result.stdout, /api\.wrapchik\.in/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
