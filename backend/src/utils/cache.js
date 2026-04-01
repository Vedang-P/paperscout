const cache = new Map();
const MAX_CACHE_ENTRIES = 600;

function pruneCache() {
  if (cache.size <= MAX_CACHE_ENTRIES) return;

  const now = Date.now();
  for (const [key, item] of cache.entries()) {
    if (now > item.expiresAt) {
      cache.delete(key);
    }
  }

  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
}

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    return null;
  }
  return item.value;
}

function getStaleCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  return item.value;
}

function setCache(key, value, ttlMs) {
  const safeTtl = Math.max(1000, Number(ttlMs) || 0);
  cache.set(key, {
    value,
    expiresAt: Date.now() + safeTtl,
  });
  pruneCache();
}

module.exports = { getCache, getStaleCache, setCache };
