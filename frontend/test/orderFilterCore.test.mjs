import test from 'node:test';
import assert from 'node:assert/strict';
import { orderFilterFromParam } from '../utils/orderFilterCore.mjs';

test('sidebar track and history links select the matching order view', () => {
  assert.equal(orderFilterFromParam('ACTIVE'), 'ACTIVE');
  assert.equal(orderFilterFromParam('COMPLETED'), 'COMPLETED');
});

test('order filter parameters normalize case and reject unknown values safely', () => {
  assert.equal(orderFilterFromParam(' active '), 'ACTIVE');
  assert.equal(orderFilterFromParam(['COMPLETED']), 'COMPLETED');
  assert.equal(orderFilterFromParam('PAID'), 'ALL');
  assert.equal(orderFilterFromParam(undefined), 'ALL');
});
