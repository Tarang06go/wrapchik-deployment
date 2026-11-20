const test = require('node:test');
const assert = require('node:assert/strict');
const healthStatus = require('../src/utils/healthStatus');

test('health endpoint reports connected DB as healthy', () => {
  const result = healthStatus(1);
  assert.equal(result.httpStatus, 200);
  assert.equal(result.body.status, 'ok');
  assert.equal(result.body.database, 'connected');
});

test('health endpoint reports unavailable DB as degraded', () => {
  const result = healthStatus(0);
  assert.equal(result.httpStatus, 503);
  assert.equal(result.body.status, 'degraded');
  assert.equal(result.body.database, 'disconnected');
});
