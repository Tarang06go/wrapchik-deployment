import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import { createReducedMotionStore } from './reducedMotionStore.mjs';

const store = createReducedMotionStore(AccessibilityInfo);

export const useReducedMotion = () => useSyncExternalStore(
  store.subscribe,
  store.getSnapshot,
  () => null,
);
