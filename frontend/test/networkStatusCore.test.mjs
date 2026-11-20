import test from 'node:test';
import assert from 'node:assert/strict';
import { isOfflineStatus, shouldReportOfflineFailure } from '../utils/networkStatusCore.js';

test('online network events hide the banner and offline events show it', () => {
  assert.equal(isOfflineStatus(true), false);
  assert.equal(isOfflineStatus(false), true);
  assert.equal(isOfflineStatus(undefined), true);
});

test('a late failure from an older request cannot override newer connectivity success', () => {
  assert.equal(shouldReportOfflineFailure(3, 4), false);
  assert.equal(shouldReportOfflineFailure(5, 4), true);
  assert.equal(shouldReportOfflineFailure(undefined, 4), true);
});
