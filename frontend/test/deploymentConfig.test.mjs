import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
const render = fs.readFileSync(new URL('render.yaml', root), 'utf8');
const ci = fs.readFileSync(new URL('.github/workflows/ci.yml', root), 'utf8');
const easUpdate = fs.readFileSync(new URL('.github/workflows/eas-update.yml', root), 'utf8');

test('Render Blueprint separates API and static PWA with HTTPS URL guard and SPA fallback', () => {
  assert.match(render, /name: wrapchik-api[\s\S]*?healthCheckPath: \/health/);
  assert.match(render, /name: wrapchik-web[\s\S]*?runtime: static/);
  assert.match(render, /validate-api-url\.cjs --profile production/);
  assert.match(render, /staticPublishPath: dist/);
  assert.match(render, /source: \/\*[\s\S]*?destination: \/index\.html/);
  assert.match(render, /key: RESEND_API_KEY[\s\S]*?sync: false/);
});

test('CI checks native runtime compatibility and secret safety; EAS updates require manual dispatch', () => {
  assert.match(ci, /check-native-runtime\.cjs/);
  assert.match(ci, /check-secrets\.cjs/);
  assert.match(easUpdate, /workflow_dispatch:/);
  assert.match(easUpdate, /EXPO_TOKEN/);
  assert.match(easUpdate, /check-native-runtime\.cjs/);
  assert.match(easUpdate, /validate-api-url\.cjs/);
  assert.match(easUpdate, /eas-cli@latest update --channel/);
  assert.doesNotMatch(easUpdate, /^on:\s*\n\s+push:/m);
});
