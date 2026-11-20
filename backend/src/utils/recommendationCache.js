const CACHE_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 128;
const entries = new Map();

const getOrCreateRecommendation = async (key, loader, now = Date.now()) => {
  const cached = entries.get(key);
  if (cached && cached.expiresAt > now) return cached.value;
  if (cached) entries.delete(key);
  const value = await loader();
  if (entries.size >= MAX_CACHE_ENTRIES) entries.delete(entries.keys().next().value);
  entries.set(key, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
};

const clearRecommendationCache = () => entries.clear();

module.exports = { CACHE_TTL_MS, getOrCreateRecommendation, clearRecommendationCache };
