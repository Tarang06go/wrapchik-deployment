import test from 'node:test';
import assert from 'node:assert/strict';
import { createReducedMotionStore } from '../utils/reducedMotionStore.mjs';

test('reduced-motion consumers share one native listener and release it when unmounted', async () => {
  let nativeListener;
  let addCount = 0;
  let removeCount = 0;
  const store = createReducedMotionStore({
    isReduceMotionEnabled: async () => false,
    addEventListener: (event, listener) => {
      assert.equal(event, 'reduceMotionChanged');
      addCount += 1;
      nativeListener = listener;
      return { remove: () => { removeCount += 1; nativeListener = null; } };
    },
  });
  let firstUpdates = 0;
  let secondUpdates = 0;
  const unsubscribeFirst = store.subscribe(() => { firstUpdates += 1; });
  const unsubscribeSecond = store.subscribe(() => { secondUpdates += 1; });
  assert.equal(store.getSnapshot(), null);
  assert.equal(addCount, 1);
  nativeListener(true);
  assert.equal(store.getSnapshot(), true);
  assert.equal(firstUpdates, 1);
  assert.equal(secondUpdates, 1);
  unsubscribeFirst();
  assert.equal(removeCount, 0);
  unsubscribeSecond();
  assert.equal(removeCount, 1);
});

test('unchanged reduced-motion values do not notify subscribers', () => {
  const store = createReducedMotionStore({ isReduceMotionEnabled: async () => false });
  let updates = 0;
  const unsubscribe = store.subscribe(() => { updates += 1; });
  assert.equal(store.getSnapshot(), null);
  unsubscribe();
  assert.equal(updates, 0);
});
