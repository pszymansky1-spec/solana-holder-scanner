// Simple in-memory TTL cache (5 minutes)
type CacheEntry<T> = { data: T; expiresAt: number };

const store = new Map<string, CacheEntry<unknown>>();
const TTL = 5 * 60 * 1000; // 5 minutes

export function getCache<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache<T>(key: string, data: T): void {
  store.set(key, { data, expiresAt: Date.now() + TTL });
}