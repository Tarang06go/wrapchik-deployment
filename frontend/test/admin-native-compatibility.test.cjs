const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('cash payment reaches the protected backend only through the awaited confirmation gate', () => {
  const orders = read('app/admin/orders.jsx');
  assert.match(orders, /await runAfterPlatformConfirmation\(\{/);
  assert.match(orders, /key: orderId,[\s\S]*?inFlight: counterPaymentInFlightRef\.current/);
  assert.match(orders, /action: async \(\) => \{\s*await adminService\.confirmCounterPayment\(orderId\)/);
  assert.doesNotMatch(orders, /window\.confirm\(/);
});

test('order rejection keeps the focused reason and decision actions scrollable with the keyboard open', () => {
  const orders = read('app/admin/orders.jsx');
  assert.match(orders, /KeyboardAvoidingView style=\{styles\.keyboardContainer\}/);
  assert.match(orders, /orderListRef\.current\?\.scrollToIndex/);
  assert.match(orders, /orderRejectInputRef\.current\?\.focus\(\)/);
  assert.match(orders, /keyboardDismissMode=\{Platform\.OS === 'ios' \? 'interactive' : 'none'\}/);
  assert.match(orders, /onScrollToIndexFailed=/);
  assert.match(orders, /Keyboard\.dismiss\(\); setRejectingOrderId\(''\)/);
});

test('shared app header applies the safe-area inset once and keeps controls touch-sized', () => {
  const header = read('components/common/Header.jsx');
  assert.match(header, /useSafeAreaInsets\(\)/);
  assert.match(header, /paddingTop: Math\.max\(0, insets\.top \|\| 0\)/);
  assert.match(header, /width: 48,[\s\S]*?height: 48/);
  assert.match(header, /minHeight: 44/);
  assert.match(header, /minWidth: 0/);
});

test('application screens do not call browser confirm/alert APIs directly', () => {
  const files = [];
  const visit = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (/\.(js|jsx)$/.test(entry.name) && !target.endsWith(`${path.sep}platformDialogs.js`)) files.push(target);
    }
  };
  visit(path.join(root, 'app'));
  visit(path.join(root, 'components'));
  const unsafe = files.filter(file => /window\.(?:confirm|alert)\s*\(|(?<![.\w])confirm\s*\(/.test(fs.readFileSync(file, 'utf8')));
  assert.deepEqual(unsafe, []);
});
