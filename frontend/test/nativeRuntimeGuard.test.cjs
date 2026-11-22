const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('native runtime guard detects native packages and requires a higher app version', () => {
  const script = path.join(__dirname, '..', 'scripts', 'check-native-runtime.cjs');
  const result = spawnSync(process.execPath, [script, '--self-test'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /self-check passed/i);
});
