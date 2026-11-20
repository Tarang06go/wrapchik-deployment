import test from 'node:test';
import assert from 'node:assert/strict';
import { outletDirectionsUrl } from '../utils/outletDirections.js';

test('all platforms use a free Google Maps URL with the configured pickup location', () => {
  for (const platform of ['android', 'ios', 'web']) {
    const url = new URL(outletDirectionsUrl(platform, 'Wrapchik SAC, TIET Patiala'));
    assert.equal(url.origin, 'https://www.google.com');
    assert.equal(url.pathname, '/maps/search/');
    assert.equal(url.searchParams.get('api'), '1');
    assert.equal(url.searchParams.get('query'), 'Wrapchik SAC, TIET Patiala');
  }
});

test('directions use the documented TIET fallback only when settings lack a location', () => {
  assert.equal(decodeURIComponent(outletDirectionsUrl('android')).includes('TIET Patiala'), true);
});
