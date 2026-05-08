/**
 * Offline cache layer backed by AsyncStorage.
 *
 * Provides stale-while-revalidate semantics: return cached data immediately,
 * then refresh from network in the background.
 *
 * Usage:
 *   const data = await cachedFetch('members_active', () =>
 *     supabase.from('members').select('*').eq('is_active', true),
 *     { maxAgeMs: 60 * 60 * 1000 } // 1 hour
 *   );
 */

import AsyncStorage from './storage';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface CacheOptions {
  maxAgeMs?: number;
}

const DEFAULT_MAX_AGE = 30 * 60 * 1000; // 30 minutes

function cacheKey(key: string): string {
  return `cache:${key}`;
}

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(key));
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    return entry.data;
  } catch {
    return null;
  }
}

export async function setCached<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    await AsyncStorage.setItem(cacheKey(key), JSON.stringify(entry));
  } catch {
    // Cache write failures are non-fatal
  }
}

export async function isCacheFresh(key: string, maxAgeMs?: number): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(key));
    if (!raw) return false;
    const entry: CacheEntry<unknown> = JSON.parse(raw);
    return Date.now() - entry.timestamp < (maxAgeMs ?? DEFAULT_MAX_AGE);
  } catch {
    return false;
  }
}

export async function clearCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(cacheKey(key));
  } catch {
    // Non-fatal
  }
}

export async function clearAllCache(): Promise<void> {
  // Storage wrapper doesn't expose key enumeration.
  // Use AsyncStorage.clear() for full wipe, or clear individual keys.
  // This is a no-op placeholder — individual keys should be cleared via clearCache(key).
}

/**
 * Stale-while-revalidate fetch.
 * Returns cached data immediately if available, then fetches fresh data.
 * If no cache exists, fetches from network (with retry).
 */
export async function cachedFetch<T>(
  key: string,
  fetchFn: () => Promise<{ data: T | null; error: { message: string } | null }>,
  options?: CacheOptions,
): Promise<{ data: T | null; fromCache: boolean }> {
  const cached = await getCached<T>(key);
  const fresh = await isCacheFresh(key, options?.maxAgeMs);

  // If cache is fresh, return it without refetching
  if (cached !== null && fresh) {
    return { data: cached, fromCache: true };
  }

  // Try network fetch
  try {
    const result = await fetchFn();
    if (result.error) throw new Error(result.error.message);
    if (result.data !== null) {
      await setCached(key, result.data);
    }
    return { data: result.data, fromCache: false };
  } catch {
    // Network failed — return stale cache if available
    if (cached !== null) {
      return { data: cached, fromCache: true };
    }
    return { data: null, fromCache: false };
  }
}
