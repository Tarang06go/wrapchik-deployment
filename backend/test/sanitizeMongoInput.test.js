const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanValue, sanitizeMongoInput } = require('../src/middleware/sanitizeMongoInput');

test('Mongo input sanitizer removes operators and dotted update paths recursively', () => {
  assert.deepEqual(cleanValue({ name: 'wrap', $where: 'true', 'profile.role': 'admin', nested: [{ $gt: 0, quantity: 2 }] }), {
    name: 'wrap', nested: [{ quantity: 2 }],
  });
});

test('Mongo input sanitizer preserves normal arrays, primitives and Date values', () => {
  const date = new Date('2026-01-01T00:00:00Z');
  assert.deepEqual(cleanValue({ list: ['x', 1, null], date }), { list: ['x', 1, null], date });
});

test('request middleware sanitizes parsed body and query before continuing', () => {
  const req = { body: { '$gt': 5, name: 'A' }, query: { 'price.$gt': '1', category: 'Wraps' } };
  let continued = false;
  sanitizeMongoInput(req, {}, () => { continued = true; });
  assert.deepEqual(req.body, { name: 'A' });
  assert.deepEqual(req.query, { category: 'Wraps' });
  assert.equal(continued, true);
});
