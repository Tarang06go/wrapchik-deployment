import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { copyPwaAssets } = require('../scripts/copy-pwa-assets.cjs');

const html = readFileSync(new URL('../app/+html.jsx', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
const icon = readFileSync(new URL('../public/wrapchik-icon.png', import.meta.url));

test('web shell exposes install metadata and iPhone safe-area support', () => {
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.match(html, /apple-touch-icon/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /ScrollViewStyleReset/);
});

test('PWA manifest uses the existing Wrapchik brand icon and standalone display', () => {
  assert.equal(manifest.name, 'Wrapchik');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#FF5722');
  assert.equal(manifest.icons[0].sizes, '1024x1024');
  assert.equal(icon.toString('ascii', 1, 4), 'PNG');
  assert.equal(icon.readUInt32BE(16), 1024);
  assert.equal(icon.readUInt32BE(20), 1024);
});

test('web export helper copies the install manifest and icon into the output root', () => {
  const output = mkdtempSync(join(tmpdir(), 'wrapchik-pwa-export-'));
  try {
    copyPwaAssets(output);
    assert.ok(existsSync(join(output, 'manifest.webmanifest')));
    assert.ok(existsSync(join(output, 'wrapchik-icon.png')));
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
