const test = require('node:test');
const assert = require('node:assert/strict');
const Order = require('../src/models/Order');
const Issue = require('../src/models/Issue');
const GroupOrder = require('../src/models/GroupOrder');

test('active order issue reporting accepts delay category only after kitchen acceptance', async () => {
  const originals = { orderFindById: Order.findById, issueCreate: Issue.create, groupExists: GroupOrder.exists };
  const created = [];
  Order.findById = async id => ({ _id: id, userId: 'student', orderStatus: id === 'ready' ? 'READY' : 'PREPARING' });
  Issue.create = async value => { created.push(value); return value; };
  try {
    const { createIssue } = require('../src/controllers/issueController');
    const response = () => ({ code: 200, status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } });
    const accepted = response();
    await createIssue({ body: { orderId: 'ready', category: 'LATE', description: 'It has been ready for 25 minutes.' }, user: { _id: 'student' } }, accepted, error => { throw error; });
    assert.equal(accepted.code, 201);
    assert.equal(created.length, 1);
    const wrongCategory = response();
    await createIssue({ body: { orderId: 'ready', category: 'QUALITY', description: 'Please check.' }, user: { _id: 'student' } }, wrongCategory, error => { throw error; });
    assert.equal(wrongCategory.code, 400);
    const forged = response();
    await createIssue({ body: { orderId: 'ready', category: 'LATE', description: 'Not my order.' }, user: { _id: 'other' } }, forged, error => { throw error; });
    assert.equal(forged.code, 403);

    Order.findById = async id => ({ _id: id, userId: 'host', groupOrderId: 'group', orderStatus: 'PREPARING' });
    GroupOrder.exists = async filter => filter._id === 'group' && filter.members.$elemMatch.userId === 'joined';
    const groupMember = response();
    await createIssue({ body: { orderId: 'group-order', category: 'LATE', description: 'Our group pickup is delayed.' }, user: { _id: 'joined' } }, groupMember, error => { throw error; });
    assert.equal(groupMember.code, 201);
  } finally { Order.findById = originals.orderFindById; Issue.create = originals.issueCreate; GroupOrder.exists = originals.groupExists; }
});
