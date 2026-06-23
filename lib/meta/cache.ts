// Tiny in-memory TTL cache. Lives for the lifetime of the server process.
// Good enough for a single-user MVP — no Redis, no DB.

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

export function getCached<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Wrap an async producer with cache-or-fetch semantics. */
export async function withCache<T>(
  key: string,
  producer: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS
): Promise<{ value: T; cached: boolean }> {
  const hit = getCached<T>(key);
  if (hit !== undefined) return { value: hit, cached: true };
  const value = await producer();
  setCached(key, value, ttlMs);
  return { value, cached: false };
}

/** Clear everything (used by the Refresh button / /api/refresh). */
export function clearCache(prefix?: string) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
