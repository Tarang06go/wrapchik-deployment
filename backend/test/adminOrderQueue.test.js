const test = require('node:test');
const assert = require('node:assert/strict');
const Order = require('../src/models/Order');

test('active kitchen queue includes actionable orders and returns oldest first', async () => {
  const originalFind = Order.find;
  const originalCount = Order.countDocuments;
  let capturedQuery;
  let capturedSort;
  Order.find = query => {
    capturedQuery = query;
    const chain = {
      populate() { return this; },
      sort(value) { capturedSort = value; return this; },
      skip() { return this; },
      limit() { return Promise.resolve([]); },
    };
    return chain;
  };
  Order.countDocuments = async () => 0;
  try {
    const { getAllOrders } = require('../src/controllers/adminController');
    const res = { body: null, json(body) { this.body = body; return this; }, status() { return this; } };
    await getAllOrders({ query: { status: 'ACTIVE', page: '1' } }, res, error => { throw error; });
    assert.deepEqual(capturedQuery, { orderStatus: { $in: ['PLACED', 'ACCEPTED', 'PREPARING', 'READY'] } });
    assert.deepEqual(capturedSort, { createdAt: 1 });
    assert.equal(res.body.success, true);
  } finally { Order.find = originalFind; Order.countDocuments = originalCount; }
});
