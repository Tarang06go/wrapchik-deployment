const cache = new Map();
const MAX_ENTRIES = 48;

const touch = (key, entry) => {
  cache.delete(key);
  cache.set(key, entry);
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
};

export const cachedRead = (key, loader, ttlMs = 15_000) => {
  const existing = cache.get(key);
  if (existing && (existing.expiresAt > Date.now() || existing.pending)) {
    touch(key, existing);
    return existing.pending ? existing.promise : Promise.resolve(existing.value);
  }
  const entry = { expiresAt: Infinity, pending: true, promise: null, value: undefined };
  entry.promise = Promise.resolve().then(loader).then(value => {
    if (cache.get(key) === entry) {
      entry.value = value;
      entry.expiresAt = Date.now() + ttlMs;
      entry.pending = false;
      entry.promise = null;
    }
    return value;
  }).catch(error => {
    if (cache.get(key) === entry) cache.delete(key);
    throw error;
  });
  touch(key, entry);
  return entry.promise;
};

export const invalidateReadCache = (prefix = '') => {
  for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
};

export const clearReadCache = () => cache.clear();
