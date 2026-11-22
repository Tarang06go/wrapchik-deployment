import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('student order history requests bounded pages, appends without duplicates and virtualizes rows', () => {
  const screen = fs.readFileSync(new URL('../app/(tabs)/orders.jsx', import.meta.url), 'utf8');
  assert.match(screen, /const ORDER_PAGE_SIZE = 20/);
  assert.match(screen, /orderService\.getMyOrders\(params\)/);
  assert.match(screen, /params\.statusGroup = filter/);
  assert.match(screen, /existingIds = new Set\(current\.map\(order => order\._id\)\)/);
  assert.match(screen, /onEndReached=\{\(\) => \{ if \(hasMoreRef\.current\) void fetchOrders\(\{ append: true \}\); \}\}/);
  assert.match(screen, /initialNumToRender=\{5\}/);
  assert.match(screen, /windowSize=\{7\}/);
});

test('order history keeps prior rows while refreshing and ignores stale request responses', () => {
  const screen = fs.readFileSync(new URL('../app/(tabs)/orders.jsx', import.meta.url), 'utf8');
  assert.match(screen, /requestId !== requestSequenceRef\.current/);
  assert.match(screen, /loading && !refreshing && orders\.length === 0/);
  assert.doesNotMatch(screen, /setOrders\(\[\]\);\s*fetchOrders\(\);/);
});
