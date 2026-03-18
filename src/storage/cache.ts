/**
 * Generic in-memory TTL cache for expensive computations.
 * Uses lazy expiration: entries are checked on get, not proactively evicted.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class TTLCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (entry === undefined) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (entry === undefined) return false;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  /** Removes all expired entries. Call periodically if memory pressure is a concern. */
  purgeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}

/** Singleton TTL cache shared across the application. */
export const cache = new TTLCache();
