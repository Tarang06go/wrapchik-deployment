const test = require('node:test');
const assert = require('node:assert/strict');
const { reserveStock } = require('../src/utils/stockReservation');

test('inventory fields default additively for catalogue and historical orders', () => {
  const Product = require('../src/models/Product');
  const Order = require('../src/models/Order');
  assert.equal(Product.schema.path('stock').defaultValue, null);
  const reservationsDefault = Order.schema.path('inventoryReservations').defaultValue;
  assert.deepEqual(typeof reservationsDefault === 'function' ? reservationsDefault() : reservationsDefault, []);
});

const fakeProductModel = (initial) => {
  const products = new Map(Object.entries(initial).map(([id, value]) => [id, { _id: id, name: value.name || id, available: value.available ?? true, stock: value.stock ?? null }]));
  return {
    products,
    findById(id) { return { select: async () => products.get(String(id)) || null }; },
    async findOneAndUpdate(filter, update) {
      const product = products.get(String(filter._id));
      const requested = filter.stock?.$gte;
      if (!product || !product.available || typeof product.stock !== 'number' || product.stock < requested) return null;
      product.stock += update.$inc.stock;
      return product;
    },
  };
};

test('atomic stock reservation prevents parallel orders from overselling', async () => {
  const Product = fakeProductModel({ a: { stock: 1 } });
  const outcomes = await Promise.allSettled([
    reserveStock([{ productId: 'a', quantity: 1 }], Product),
    reserveStock([{ productId: 'a', quantity: 1 }], Product),
  ]);
  assert.equal(outcomes.filter((row) => row.status === 'fulfilled').length, 1);
  assert.equal(Product.products.get('a').stock, 0);
});

test('a failed multi-item reservation restores earlier stock and unlimited items are not decremented', async () => {
  const Product = fakeProductModel({ a: { stock: 4 }, b: { stock: 1 }, c: { stock: null } });
  await assert.rejects(reserveStock([
    { productId: 'a', quantity: 2 },
    { productId: 'b', quantity: 2 },
  ], Product), /Not enough stock/);
  assert.equal(Product.products.get('a').stock, 4);
  const reservations = await reserveStock([
    { productId: 'a', quantity: 1 },
    { productId: 'a', quantity: 1 },
    { productId: 'c', quantity: 3 },
  ], Product);
  assert.deepEqual(reservations, [{ productId: 'a', quantity: 2 }]);
  assert.equal(Product.products.get('a').stock, 2);
  assert.equal(Product.products.get('c').stock, null);
});
