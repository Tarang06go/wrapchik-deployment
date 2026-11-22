import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const projectId = app.extra.eas.projectId;
const androidManifest = readFileSync(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
const androidGradle = readFileSync(new URL('../android/app/build.gradle', import.meta.url), 'utf8');
const debugManifest = readFileSync(new URL('../android/app/src/debug/AndroidManifest.xml', import.meta.url), 'utf8');
const buildProperties = app.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties')?.[1];

test('EAS Update uses this EAS project and native-compatible app-version runtime', () => {
  assert.equal(app.version, packageJson.version);
  assert.match(androidGradle, /versionCode\s+2/);
  assert.match(androidGradle, /versionName\s+"1\.0\.1"/);
  assert.equal(packageJson.dependencies['expo-updates'], '~57.0.28');
  assert.ok(app.plugins.includes('expo-updates'));
  assert.equal(app.updates.url, `https://u.expo.dev/${projectId}`);
  assert.deepEqual(app.runtimeVersion, { policy: 'appVersion' });
  assert.match(androidManifest, /expo\.modules\.updates\.ENABLED" android:value="true"/);
  assert.match(androidManifest, /expo\.modules\.updates\.EXPO_UPDATE_URL" android:value="https:\/\/u\.expo\.dev\//);
  assert.match(androidManifest, /expo\.modules\.updates\.EXPO_RUNTIME_VERSION" android:value="@string\/expo_runtime_version"/);
});

test('development, preview, and production builds use distinct matching update channels', () => {
  assert.equal(eas.build.development.channel, 'development');
  assert.equal(eas.build.preview.channel, 'preview');
  assert.equal(eas.build.production.channel, 'production');
});

test('cleartext HTTP is limited to Android debug builds; release config requires TLS', () => {
  assert.equal(buildProperties.android.usesCleartextTraffic, false);
  assert.match(androidManifest, /android:usesCleartextTraffic="false"/);
  assert.match(debugManifest, /android:usesCleartextTraffic="true"/);
});
