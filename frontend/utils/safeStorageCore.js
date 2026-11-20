const DEFAULT_TIMEOUT_MS = 3000;

export const createSafeStorage = ({
  asyncStorage,
  secureStore,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onError = (message) => console.warn(`[Storage] ${message}`),
}) => {
  const memory = new Map();
  const cacheKey = (key, secure = false) => `${secure ? 'secure' : 'async'}:${key}`;

  const runBounded = async (label, operation) => {
    let timer;
    try {
      const task = Promise.resolve().then(operation);
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      });
      await Promise.race([task, timeout]);
      return true;
    } catch (error) {
      onError(`${label} unavailable; using in-memory fallback: ${error?.message || 'storage error'}`);
      return false;
    } finally {
      clearTimeout(timer);
    }
  };

  const getItem = async (key, { secure = false } = {}) => {
    const cachedKey = cacheKey(key, secure);
    if (memory.has(cachedKey)) return memory.get(cachedKey);
    const store = secure ? secureStore : asyncStorage;
    const read = secure ? store?.getItemAsync : store?.getItem;
    if (typeof read !== 'function') return null;

    let timer;
    try {
      const task = Promise.resolve().then(() => read.call(store, key));
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`read timed out after ${timeoutMs}ms`)), timeoutMs);
      });
      const value = await Promise.race([task, timeout]);
      if (value !== null && value !== undefined) memory.set(cachedKey, value);
      return value ?? null;
    } catch (error) {
      onError(`${secure ? 'SecureStore' : 'AsyncStorage'} read unavailable; using in-memory fallback: ${error?.message || 'storage error'}`);
      return memory.has(cachedKey) ? memory.get(cachedKey) : null;
    } finally {
      clearTimeout(timer);
    }
  };

  const setItem = async (key, value, { secure = false } = {}) => {
    memory.set(cacheKey(key, secure), value);
    const store = secure ? secureStore : asyncStorage;
    const write = secure ? store?.setItemAsync : store?.setItem;
    if (typeof write !== 'function') return false;
    return runBounded(`${secure ? 'SecureStore' : 'AsyncStorage'} write`, () => write.call(store, key, value));
  };

  const removeItem = async (key, { secure = false } = {}) => {
    memory.delete(cacheKey(key, secure));
    const store = secure ? secureStore : asyncStorage;
    const remove = secure ? store?.deleteItemAsync : store?.removeItem;
    if (typeof remove !== 'function') return false;
    return runBounded(`${secure ? 'SecureStore' : 'AsyncStorage'} removal`, () => remove.call(store, key));
  };

  const multiRemove = async (keys) => {
    keys.forEach((key) => memory.delete(cacheKey(key)));
    if (typeof asyncStorage?.multiRemove !== 'function') return false;
    return runBounded('AsyncStorage session cleanup', () => asyncStorage.multiRemove(keys));
  };

  return { getItem, setItem, removeItem, multiRemove };
};

export { DEFAULT_TIMEOUT_MS };
