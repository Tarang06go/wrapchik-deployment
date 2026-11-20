const test = require('node:test');
const assert = require('node:assert/strict');
const Product = require('../src/models/Product');

test('products are not featured unless an admin turns the flag on', () => {
  assert.equal(Product.schema.path('isFeatured').defaultValue, false);
  assert.equal(new Product({ name: 'x', description: 'y', price: 1, imageUrl: 'z', categoryId: '64b000000000000000000001' }).isFeatured, false);
});
