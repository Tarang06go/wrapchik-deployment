const test = require('node:test');
const assert = require('node:assert/strict');
const GroupOrder = require('../src/models/GroupOrder');

test('my group history paginates the caller-owned group query before populating and summarizing', async () => {
  const originalFind = GroupOrder.find;
  let capturedFilter;
  let capturedSkip;
  let capturedLimit;
  const rows = Array.from({ length: 3 }, (_, index) => ({
    _id: `group-${index}`, name: `Meal ${index}`, groupCode: `CODE${index}`,
    leaderId: 'student-id', members: [{ userId: 'student-id', status: 'JOINED' }],
    contributions: [], status: 'OPEN', maxMembers: 8,
  }));
  GroupOrder.find = filter => {
    capturedFilter = filter;
    const query = {
      select() { return this; }, sort() { return this; },
      skip(value) { capturedSkip = value; return this; },
      limit(value) { capturedLimit = value; return this; },
      populate() { return this; },
      lean() { return Promise.resolve(rows); },
    };
    return query;
  };
  try {
    const { getMyGroups } = require('../src/controllers/groupOrderController');
    const res = { json(body) { this.body = body; return this; }, status(code) { this.statusCode = code; return this; } };
    await getMyGroups({ user: { _id: 'student-id' }, query: { limit: '2', skip: '4' } }, res, error => { throw error; });
    assert.deepEqual(capturedFilter.$or, [
      { leaderId: 'student-id' }, { members: { $elemMatch: { userId: 'student-id' } } },
    ]);
    assert.equal(capturedSkip, 4);
    assert.equal(capturedLimit, 3);
    assert.equal(res.body.groups.length, 2);
    assert.equal(res.body.hasMore, true);
  } finally { GroupOrder.find = originalFind; }
});

test('my group list rejects malformed page limits', async () => {
  const originalFind = GroupOrder.find;
  GroupOrder.find = () => { throw new Error('Database query must not run for invalid paging.'); };
  try {
    const { getMyGroups } = require('../src/controllers/groupOrderController');
    const res = { json(body) { this.body = body; return this; }, status(code) { this.statusCode = code; return this; } };
    await getMyGroups({ user: { _id: 'student-id' }, query: { limit: '-2' } }, res, error => { throw error; });
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /group page request/i);
  } finally { GroupOrder.find = originalFind; }
});
