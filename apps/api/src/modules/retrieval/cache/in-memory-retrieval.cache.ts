import { Injectable } from '@nestjs/common';
import { RetrievalCache } from '../interfaces/retrieval-cache.interface';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * In-process cache used when Redis is unavailable or for unit tests.
 */
@Injectable()
export class InMemoryRetrievalCache implements RetrievalCache {
  private readonly store = new Map<string, CacheEntry>();

  get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return Promise.resolve(null);
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return Promise.resolve(null);
    }
    return Promise.resolve(entry.value as T);
  }

  set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }
}
