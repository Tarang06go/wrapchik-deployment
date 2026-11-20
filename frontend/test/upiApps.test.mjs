import test from 'node:test';
import assert from 'node:assert/strict';
import { UPI_APPS, isUpiUri, buildAppUri, discoverUpiApps } from '../utils/upiApps.js';

const URI = 'upi://pay?pa=wrapchik@bank&pn=Wrapchik%20TIET&tr=abc&tn=Wrapchik%20order%20WRP-1&am=120.00&cu=INR';

test('accepts well-formed UPI links and rejects malformed ones', () => {
  assert.equal(isUpiUri(URI), true);
  assert.equal(isUpiUri('https://example.com'), false);
  assert.equal(isUpiUri('upi://pay?pn=x&am=10.00'), false);
  assert.equal(isUpiUri('upi://pay?pa=a@b&am=abc'), false);
  assert.equal(isUpiUri(undefined), false);
});

test('app-specific URIs keep the identical query string', () => {
  const query = URI.slice(URI.indexOf('?'));
  for (const app of UPI_APPS) assert.equal(buildAppUri(URI, app), `${app.scheme}${query}`);
  assert.throws(() => buildAppUri('nope', UPI_APPS[0]));
});

test('discovery returns only apps that canOpenURL reports as installed', async () => {
  const installed = await discoverUpiApps(URI, async (u) => u.startsWith('phonepe://'));
  assert.deepEqual(installed.map((a) => a.id), ['phonepe']);
  assert.deepEqual(await discoverUpiApps(URI, async () => { throw new Error('x'); }), []);
  assert.deepEqual(await discoverUpiApps('bad', async () => true), []);
});
