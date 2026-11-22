const test = require('node:test');
const assert = require('node:assert/strict');
const Order = require('../src/models/Order');
const GroupOrder = require('../src/models/GroupOrder');

test('ready pickup lookup restricts results to the requesting student or active group membership and paid READY takeaways', async () => {
  const originals = { orderFind: Order.find, groupFind: GroupOrder.find };
  let captured;
  GroupOrder.find = () => ({ select() { return this; }, lean: async () => [{ _id: 'group-id' }] });
  Order.find = query => {
    captured = query;
    return { populate() { return this; }, sort: async () => [] };
  };
  try {
    const { getMyOrders } = require('../src/controllers/orderController');
    const res = { json(body) { this.body = body; return this; } };
    await getMyOrders({ user: { _id: 'student-id' }, query: { readyPickup: 'true' } }, res, error => { throw error; });
    assert.deepEqual(captured.$and[0].$or, [
      { userId: 'student-id' }, { groupOrderId: { $in: ['group-id'] } },
    ]);
    assert.deepEqual(captured.$and[1], { orderType: 'TAKEAWAY', orderStatus: 'READY', paymentStatus: 'SUCCESS' });
    assert.deepEqual(res.body.orders, []);
  } finally { Order.find = originals.orderFind; GroupOrder.find = originals.groupFind; }
});

test('home order summary returns bounded current records instead of the full order history', async () => {
  const originals = { orderFind: Order.find, groupFind: GroupOrder.find };
  const calls = [];
  GroupOrder.find = () => ({ select() { return this; }, lean: async () => [{ _id: 'group-id' }] });
  Order.find = query => {
    const call = { query, limit: null };
    calls.push(call);
    const rows = calls.length === 1 ? [{ _id: 'ready-id' }] : [{ _id: 'pending-id' }];
    const chain = {
      select() { return this; }, populate() { return this; }, sort() { return this; },
      limit(value) { call.limit = value; return this; }, lean() { return Promise.resolve(rows); },
    };
    return chain;
  };
  try {
    const { getMyOrders } = require('../src/controllers/orderController');
    const res = { json(body) { this.body = body; return this; } };
    await getMyOrders({ user: { _id: 'student-id' }, query: { homeSummary: 'true' } }, res, error => { throw error; });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].limit, 1);
    assert.equal(calls[1].limit, 20);
    assert.deepEqual(calls[0].query.$and[0].$or, [
      { userId: 'student-id' }, { groupOrderId: { $in: ['group-id'] } },
    ]);
    assert.equal(calls[1].query.groupOrderId, null);
    assert.deepEqual(res.body.readyPickupOrder, { _id: 'ready-id' });
    assert.deepEqual(res.body.pendingPaymentOrders, [{ _id: 'pending-id' }]);
  } finally { Order.find = originals.orderFind; GroupOrder.find = originals.groupFind; }
});

test('order history supports bounded status-group pages and signals more records', async () => {
  const originals = { orderFind: Order.find, groupFind: GroupOrder.find };
  let queryFilter;
  let requestedSkip;
  let requestedLimit;
  const rows = Array.from({ length: 11 }, (_, index) => ({ _id: `order-${index}` }));
  GroupOrder.find = () => ({ select() { return this; }, lean: async () => [] });
  Order.find = filter => {
    queryFilter = filter;
    const chain = {
      populate() { return this; }, sort() { return this; },
      skip(value) { requestedSkip = value; return this; },
      limit(value) { requestedLimit = value; return this; },
      then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); },
    };
    return chain;
  };
  try {
    const { getMyOrders } = require('../src/controllers/orderController');
    const res = { json(body) { this.body = body; return this; }, status(code) { this.statusCode = code; return this; } };
    await getMyOrders({ user: { _id: 'student-id' }, query: { statusGroup: 'ACTIVE', limit: '10', skip: '20' } }, res, error => { throw error; });
    assert.deepEqual(queryFilter.$and[1], { orderStatus: { $in: ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP'] } });
    assert.equal(requestedSkip, 20);
    assert.equal(requestedLimit, 11);
    assert.equal(res.body.orders.length, 10);
    assert.equal(res.body.hasMore, true);
  } finally { Order.find = originals.orderFind; GroupOrder.find = originals.groupFind; }
});

test('order history rejects malformed pagination rather than silently loading all records', async () => {
  const originalGroupFind = GroupOrder.find;
  GroupOrder.find = () => ({ select() { return this; }, lean: async () => [] });
  try {
    const { getMyOrders } = require('../src/controllers/orderController');
    const res = { json(body) { this.body = body; return this; }, status(code) { this.statusCode = code; return this; } };
    await getMyOrders({ user: { _id: 'student-id' }, query: { limit: '5000' } }, res, error => { throw error; });
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /page request/i);
  } finally { GroupOrder.find = originalGroupFind; }
});
