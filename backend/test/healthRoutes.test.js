const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'wrapchik-health-route-test-secret-32';
process.env.TRUST_PROXY_HOPS = '0';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/wrapchik_test_only';

const { app } = require('../src/server');

test('HTTP /health is live while /ready reports a disconnected database', async (t) => {
  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const address = server.address();
  const [live, ready] = await Promise.all([
    fetch(`http://127.0.0.1:${address.port}/health`),
    fetch(`http://127.0.0.1:${address.port}/ready`),
  ]);
  assert.equal(live.status, 200);
  assert.equal((await live.json()).service, 'live');
  assert.equal(ready.status, 503);
  assert.equal((await ready.json()).database, 'disconnected');
});
