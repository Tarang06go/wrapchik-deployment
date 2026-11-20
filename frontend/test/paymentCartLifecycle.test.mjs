import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('mounting payment does not clear a shared or historical cart', () => {
  const payment = read('../app/payment.jsx');
  assert.doesNotMatch(payment, /clearCart|clearCheckoutIntentKey/);
  assert.match(payment, /useEffect\(\(\) => \{ void refresh\(\); \}, \[refresh\]\)/);
});

test('cart clear callback is stable and checkout clears only after order creation', () => {
  const cart = read('../context/CartContext.jsx');
  const checkout = read('../app/checkout.jsx');
  assert.match(cart, /const clearCart = useCallback\(async \(\) =>/);
  assert.match(checkout, /if \(res && res\.success && res\.order\) \{/);
  assert.match(checkout, /await clearCheckoutIntentKey\(\);\s*await clearCart\(\);/);
});
