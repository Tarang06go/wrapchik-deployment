import test from 'node:test';
import assert from 'node:assert/strict';
import { createSafeStorage } from '../utils/safeStorageCore.js';

const stalled = () => new Promise(() => {});

test('stalled storage reads resolve within the timeout and return in-memory fallback', async () => {
  const errors = [];
  const storage = createSafeStorage({ asyncStorage: { getItem: stalled }, timeoutMs: 15, onError: (message) => errors.push(message) });
  await storage.setItem('cart', 'cached');
  assert.equal(await storage.getItem('cart'), 'cached');

  const emptyStorage = createSafeStorage({ asyncStorage: { getItem: stalled }, timeoutMs: 15, onError: (message) => errors.push(message) });
  assert.equal(await emptyStorage.getItem('empty'), null);
  assert.equal(errors.some((message) => message.includes('timed out')), true);
});

test('stalled writes keep values available in memory and removals clear the fallback', async () => {
  const storage = createSafeStorage({
    asyncStorage: { setItem: stalled, removeItem: stalled },
    timeoutMs: 15,
    onError: () => {},
  });
  assert.equal(await storage.setItem('session', 'token'), false);
  assert.equal(await storage.getItem('session'), 'token');
  assert.equal(await storage.removeItem('session'), false);
  assert.equal(await storage.getItem('session'), null);
});

test('rejected AsyncStorage and SecureStore calls fall back without throwing', async () => {
  const reject = async () => { throw new Error('native storage rejected'); };
  const storage = createSafeStorage({
    asyncStorage: { getItem: reject, setItem: reject, removeItem: reject, multiRemove: reject },
    secureStore: { getItemAsync: reject, setItemAsync: reject, deleteItemAsync: reject },
    timeoutMs: 30,
    onError: () => {},
  });
  assert.equal(await storage.getItem('profile'), null);
  assert.equal(await storage.setItem('profile', 'cached'), false);
  assert.equal(await storage.getItem('profile'), 'cached');
  assert.equal(await storage.setItem('token', 'cached-token', { secure: true }), false);
  assert.equal(await storage.getItem('token', { secure: true }), 'cached-token');
  assert.equal(await storage.multiRemove(['profile', 'token']), false);
  assert.equal(await storage.getItem('profile'), null);
  assert.equal(await storage.getItem('token', { secure: true }), 'cached-token');
  assert.equal(await storage.removeItem('token', { secure: true }), false);
  assert.equal(await storage.getItem('token', { secure: true }), null);
});
