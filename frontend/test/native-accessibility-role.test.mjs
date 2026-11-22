import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const collect = (root) => readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
  const path = join(root, entry.name);
  return entry.isDirectory() ? collect(path) : /\.[jt]sx?$/.test(entry.name) ? [path] : [];
});

test('native screens do not assign unsupported status as an accessibilityRole', () => {
  const files = [...collect('app'), ...collect('components')];
  const invalid = files.flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    return /accessibilityRole\s*=\s*(?:"status"|'status'|\{\s*[^}]*\?\s*['"]alert['"]\s*:\s*['"]status['"])/.test(source) ? [file] : [];
  });
  assert.deepEqual(invalid, [], `unsupported accessibilityRole="status" remains in: ${invalid.join(', ')}`);
});
