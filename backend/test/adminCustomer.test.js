const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Order = require('../src/models/Order');
const CustomerAccountAudit = require('../src/models/CustomerAccountAudit');
const socketManager = require('../src/config/socketManager');
const { listCustomers, setCustomerActive } = require('../src/controllers/adminCustomerController');

const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('customer listing escapes search text and reports only paid-order aggregates', async () => {
  const originals = { find: User.find, count: User.countDocuments, aggregate: Order.aggregate };
  const customerId = new mongoose.Types.ObjectId();
  let capturedFilter;
  User.find = (filter) => {
    capturedFilter = filter;
    const query = { select() { return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; }, lean: async () => [{ _id: customerId, name: 'Student', email: 's@thapar.edu', isActive: true }] };
    return query;
  };
  User.countDocuments = async () => 1;
  Order.aggregate = async () => [{ _id: customerId, orderCount: 2, spend: 250, lastOrderAt: new Date('2026-01-01T00:00:00Z') }];
  try {
    const res = response();
    await listCustomers({ query: { page: '2', limit: '500', search: 'a.b' } }, res, (error) => { throw error; });
    assert.equal(capturedFilter.role, 'student');
    assert.equal(capturedFilter.$or[0].name.$regex, 'a\\.b');
    assert.deepEqual([res.body.page, res.body.limit, res.body.total], [2, 100, 1]);
    assert.deepEqual([res.body.customers[0].orderCount, res.body.customers[0].verifiedSpend], [2, 250]);
  } finally {
    User.find = originals.find;
    User.countDocuments = originals.count;
    Order.aggregate = originals.aggregate;
  }
});

test('account disable records an audit entry and disconnects active sockets', async () => {
  const originals = { findOne: User.findOne, create: CustomerAccountAudit.create, disconnect: socketManager.disconnectUserSockets };
  const customerId = new mongoose.Types.ObjectId();
  const actorId = new mongoose.Types.ObjectId();
  const customer = { _id: customerId, role: 'student', isActive: true, save: async () => {} };
  let audit;
  let disconnected;
  User.findOne = async () => customer;
  CustomerAccountAudit.create = async (record) => { audit = record; };
  socketManager.disconnectUserSockets = (id) => { disconnected = String(id); };
  try {
    const res = response();
    await setCustomerActive({ params: { id: String(customerId) }, body: { isActive: false }, user: { _id: actorId } }, res, (error) => { throw error; });
    assert.equal(res.body.isActive, false);
    assert.equal(audit.previousActive, true);
    assert.equal(audit.nextActive, false);
    assert.equal(String(audit.actorId), String(actorId));
    assert.equal(disconnected, String(customerId));
  } finally {
    User.findOne = originals.findOne;
    CustomerAccountAudit.create = originals.create;
    socketManager.disconnectUserSockets = originals.disconnect;
  }
});

test('customer changes reject invalid IDs, non-students, and non-boolean status values', async () => {
  const res = response();
  await setCustomerActive({ params: { id: 'bad-id' }, body: { isActive: false }, user: { _id: new mongoose.Types.ObjectId() } }, res, (error) => { throw error; });
  assert.equal(res.statusCode, 400);
  assert.equal(CustomerAccountAudit.schema.path('createdAt').options.immutable, true);
  assert.equal(CustomerAccountAudit.schema.path('targetUserId').isRequired, true);
});
