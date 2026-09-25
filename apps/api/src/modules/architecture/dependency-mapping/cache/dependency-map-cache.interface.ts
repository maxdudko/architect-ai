export interface DependencyMapCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export const DEPENDENCY_MAP_CACHE = Symbol('DEPENDENCY_MAP_CACHE');
