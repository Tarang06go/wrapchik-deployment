import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('My Groups loads bounded pages and keeps the history list virtualized', () => {
  const screen = fs.readFileSync(new URL('../app/my-groups.jsx', import.meta.url), 'utf8');
  assert.match(screen, /const GROUP_PAGE_SIZE = 20/);
  assert.match(screen, /groupService\.getMyGroups\(\{ limit, skip \}\)/);
  assert.match(screen, /pageOffsetRef\.current = skip \+ result\.groups\.length/);
  assert.match(screen, /onEndReached=\{\(\) => \{ if \(visibleGroups\.length\) loadOlderGroups\(\); \}\}/);
  assert.match(screen, /initialNumToRender=\{6\}/);
  assert.match(screen, /windowSize=\{7\}/);
});
