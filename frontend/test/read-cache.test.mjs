import test from 'node:test';
import assert from 'node:assert/strict';
import { cachedRead, clearReadCache, invalidateReadCache } from '../services/readCache.js';

test('safe GET reads coalesce concurrent calls and reuse a short-lived result', async () => {
  clearReadCache();
  let calls = 0;
  const loader = async () => { calls += 1; await Promise.resolve(); return { products: [1, 2] }; };
  const [first, second] = await Promise.all([cachedRead('catalog:products:all', loader), cachedRead('catalog:products:all', loader)]);
  assert.equal(calls, 1);
  assert.equal(first, second);
  await cachedRead('catalog:products:all', loader);
  assert.equal(calls, 1);
});

test('cache invalidation is scoped and failed reads are retried instead of cached', async () => {
  clearReadCache();
  let calls = 0;
  await cachedRead('catalog:user:a', async () => ++calls);
  await cachedRead('catalog:user:b', async () => ++calls);
  invalidateReadCache('catalog:user:a');
  await cachedRead('catalog:user:a', async () => ++calls);
  assert.equal(calls, 3);
  await assert.rejects(cachedRead('catalog:broken', async () => { throw new Error('offline'); }));
  assert.equal(await cachedRead('catalog:broken', async () => 'recovered'), 'recovered');
});
