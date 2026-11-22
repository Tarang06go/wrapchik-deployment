import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('unchanged product-card presentation can skip cart updates and uses an indexed cart lookup', () => {
  const card = fs.readFileSync(new URL('../components/product/ProductCard.jsx', import.meta.url), 'utf8');
  const cart = fs.readFileSync(new URL('../context/CartContext.jsx', import.meta.url), 'utf8');
  assert.match(card, /React\.memo\(function ProductCardPresentation/);
  assert.match(card, /cartItemByProductId\?\.get\(product\._id\)/);
  assert.doesNotMatch(card, /cartItems\.find\(/);
  assert.match(cart, /cartItemByProductId: new Map\(\)/);
  assert.match(cart, /const value = useMemo\(/);
});
