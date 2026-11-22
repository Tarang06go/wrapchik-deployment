export function createReducedMotionStore(accessibilityInfo) {
  let value = null;
  let started = false;
  let nativeSubscription = null;
  let changeVersion = 0;
  const listeners = new Set();

  const publish = next => {
    const nextValue = Boolean(next);
    if (value === nextValue) return;
    value = nextValue;
    listeners.forEach(listener => listener());
  };

  const start = () => {
    if (started) return;
    started = true;
    const initialReadVersion = changeVersion;
    try {
      Promise.resolve(accessibilityInfo?.isReduceMotionEnabled?.()).then(next => {
        if (changeVersion === initialReadVersion) publish(next);
      }).catch(() => { if (changeVersion === initialReadVersion) publish(false); });
    } catch { publish(false); }
    try {
      nativeSubscription = accessibilityInfo?.addEventListener?.('reduceMotionChanged', next => {
        changeVersion += 1;
        publish(next);
      }) || null;
    } catch { nativeSubscription = null; }
  };

  const subscribe = listener => {
    listeners.add(listener);
    if (listeners.size === 1) start();
    return () => {
      listeners.delete(listener);
      if (!listeners.size) {
        nativeSubscription?.remove?.();
        nativeSubscription = null;
        started = false;
      }
    };
  };

  return { subscribe, getSnapshot: () => value };
}
