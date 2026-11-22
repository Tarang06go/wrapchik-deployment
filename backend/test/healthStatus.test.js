const test = require('node:test');
const assert = require('node:assert/strict');
const { livenessStatus, readinessStatus } = require('../src/utils/healthStatus');

test('readiness reports connected DB as healthy', () => {
  const result = readinessStatus(1);
  assert.equal(result.httpStatus, 200);
  assert.equal(result.body.status, 'ok');
  assert.equal(result.body.database, 'connected');
});

test('readiness reports unavailable DB as degraded', () => {
  const result = readinessStatus(0);
  assert.equal(result.httpStatus, 503);
  assert.equal(result.body.status, 'degraded');
  assert.equal(result.body.database, 'disconnected');
});

test('liveness stays healthy while MongoDB is unavailable', () => {
  const result = livenessStatus();
  assert.equal(result.httpStatus, 200);
  assert.equal(result.body.status, 'ok');
  assert.equal(result.body.service, 'live');
});
