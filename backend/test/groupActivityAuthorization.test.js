const test = require('node:test');
const assert = require('node:assert/strict');
const GroupOrder = require('../src/models/GroupOrder');
const GroupActivity = require('../src/models/GroupActivity');
const { getGroupActivity, getMyGroups } = require('../src/controllers/groupOrderController');

const groupId = '64b000000000000000000001';
const userId = '64b000000000000000000002';

const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});
test('activity feed requires group membership and selects only safe event fields', async () => {
  const originalExists = GroupOrder.exists;
  const originalFind = GroupActivity.find;
  let selectedFields = '';
  let feedRead = false;
  try {
    GroupOrder.exists = async query => {
      assert.equal(String(query._id), groupId);
      assert.deepEqual(query.$or, [
        { leaderId: userId },
        { members: { $elemMatch: { userId } } },
      ]);
      return { _id: groupId };
    };
    GroupActivity.find = filter => {
      feedRead = true;
      assert.equal(String(filter.groupId), groupId);
      const query = {
        select(fields) { selectedFields = fields; return this; },
        sort() { return this; },
        limit(count) { assert.equal(count, 40); return this; },
        async lean() { return [{ type: 'MEMBER_JOINED', actorName: 'Student', message: 'Joined the group.' }]; },
      };
      return query;
    };

    const res = response();
    await getGroupActivity({ params: { id: groupId }, user: { _id: userId } }, res, error => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.activity[0], { type: 'MEMBER_JOINED', actorName: 'Student', message: 'Joined the group.' });
    assert.equal(selectedFields, 'type actorName message createdAt');
    assert.equal(/amount|upi|reference|token/i.test(selectedFields), false);
    assert.equal(feedRead, true);
  } finally {
    GroupOrder.exists = originalExists;
    GroupActivity.find = originalFind;
  }
});
test('group list query includes groups hosted or joined, including historical memberships', async () => {
  const originalFind = GroupOrder.find;
  let queryFilter;
  try {
    GroupOrder.find = filter => {
      queryFilter = filter;
      return {
        select() { return this; },
        sort() { return this; },
        populate() { return this; },
        async lean() { return []; },
      };
    };
    const res = response();
    await getMyGroups({ user: { _id: userId } }, res, error => { throw error; });
    assert.deepEqual(queryFilter.$or, [
      { leaderId: userId },
      { members: { $elemMatch: { userId } } },
    ]);
    assert.equal(Object.hasOwn(queryFilter, 'status'), false);
    assert.equal(res.body.success, true);
  } finally {
    GroupOrder.find = originalFind;
  }
});
