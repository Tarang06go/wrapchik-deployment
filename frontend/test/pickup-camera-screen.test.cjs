const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('pickup scanner reports actual native camera/module and permission failures', () => {
  const screen = read('app/admin/pickup.jsx');
  assert.doesNotMatch(screen, /unavailable in this Expo Go build/i);
  assert.match(screen, /Camera support is not included in this installed Wrapchik build/);
  assert.match(screen, /Enable Camera permission for Wrapchik in Android Settings/);
  assert.match(screen, /Could not initialize the camera:/);
  assert.match(screen, /onMountError={onCameraMountError}/);
  assert.match(screen, /onCameraReady=\{\(\) => setMessage/);
});

test('scanner requests native camera permission and mounts an active QR-only preview', () => {
  const screen = read('app/admin/pickup.jsx');
  assert.match(screen, /await import\('expo-camera'\)/);
  assert.match(screen, /getCameraPermissionsAsync/);
  assert.match(screen, /requestCameraPermissionsAsync/);
  assert.match(screen, /active=\{scanning\}/);
  assert.match(screen, /barcodeTypes: \['qr'\]/);
  assert.match(screen, /onBarcodeScanned=\{onBarcodeScanned\}/);
});

test('manual one-time verification remains available and calls the protected pickup service', () => {
  const screen = read('app/admin/pickup.jsx');
  assert.match(screen, /Order ID/);
  assert.match(screen, /One-time pickup code/);
  assert.match(screen, /Verify collection/);
  assert.match(screen, /adminService\.verifyPickupQr/);
  assert.match(screen, /Scan customer pickup QR/);
});

test('native Android build source includes camera permission without microphone access', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const appJson = read('app.json');
  const easignore = read('.easignore');
  assert.match(manifest, /android\.permission\.CAMERA/);
  assert.doesNotMatch(manifest, /android\.permission\.RECORD_AUDIO/);
  assert.match(appJson, /"expo-camera"/);
  assert.match(appJson, /"recordAudioAndroid": false/);
  assert.doesNotMatch(easignore, /^android\/$/m);
});

test('pickup layout stays compact, scrollable, and respects the bottom safe area', () => {
  const screen = read('app/admin/pickup.jsx');
  assert.match(screen, /useSafeAreaInsets\(\)/);
  assert.match(screen, /paddingBottom: Math\.max\(insets\.bottom, 12\)/);
  assert.match(screen, /<ScrollView contentContainerStyle=/);
  assert.match(screen, /height: 190/);
  assert.match(screen, /fontSize: 20/);
  assert.match(screen, /size="small"/);
});
