const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeUpiReference, hashUpiReference } = require('../src/utils/upiReference');

test('UPI transaction references hash consistently across harmless spaces and case differences', () => {
  assert.equal(normalizeUpiReference('  abC-123  '), 'ABC-123');
  assert.equal(hashUpiReference(' abC-123 '), hashUpiReference('ABC-123'));
  assert.notEqual(hashUpiReference('ABC-123'), hashUpiReference('ABC-124'));
});
