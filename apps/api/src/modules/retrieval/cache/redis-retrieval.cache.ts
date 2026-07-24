import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RetrievalCache } from '../interfaces/retrieval-cache.interface';
import { InMemoryRetrievalCache } from './in-memory-retrieval.cache';

@Injectable()
export class RedisRetrievalCache
  implements RetrievalCache, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisRetrievalCache.name);
  private client: Redis | null = null;
  private readonly fallback = new InMemoryRetrievalCache();
  private readonly keyPrefix: string;

  constructor(private readonly configService: ConfigService) {
    this.keyPrefix =
      this.configService.get<string>('RETRIEVAL_CACHE_PREFIX') ??
      'architect:retrieval:';
  }

  onModuleInit(): void {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL is not configured; retrieval cache using in-memory fallback',
      );
      return;
    }

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
      this.client.on('error', (error) => {
        this.logger.warn(`Redis retrieval cache error: ${error.message}`);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to connect Redis retrieval cache (${message}); using in-memory fallback`,
      );
      this.client = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) {
      return this.fallback.get<T>(key);
    }

    try {
      const raw = await this.client.get(this.prefixed(key));
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis cache get failed (${message}); using fallback`);
      return this.fallback.get<T>(key);
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (!this.client) {
      await this.fallback.set(key, value, ttlSeconds);
      return;
    }

    try {
      await this.client.set(
        this.prefixed(key),
        JSON.stringify(value),
        'EX',
        ttlSeconds,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis cache set failed (${message}); using fallback`);
      await this.fallback.set(key, value, ttlSeconds);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.client) {
      await this.fallback.delete(key);
      return;
    }

    try {
      await this.client.del(this.prefixed(key));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Redis cache delete failed (${message}); using fallback`,
      );
      await this.fallback.delete(key);
    }
  }

  private prefixed(key: string): string {
    return `${this.keyPrefix}${key}`;
  }
}
