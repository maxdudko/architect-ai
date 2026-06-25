import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class SessionStoreService implements OnModuleDestroy {
  private readonly logger = new Logger(SessionStoreService.name);
  private readonly memory = new Map<string, Set<string>>();
  private readonly redis: Redis | null;

  constructor(configService: ConfigService) {
    const redisUrl = configService.get<string>('REDIS_URL');
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
      void this.redis.connect().catch((error: unknown) => {
        this.logger.warn(
          `Redis unavailable for session store, fallback to memory: ${String(error)}`,
        );
      });
    } else {
      this.redis = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  async addRefreshToken(userId: string, refreshToken: string): Promise<void> {
    if (this.redis) {
      await this.redis.sadd(this.key(userId), refreshToken);
      await this.redis.expire(this.key(userId), 60 * 60 * 24 * 30);
      return;
    }

    const tokenSet = this.memory.get(userId) ?? new Set<string>();
    tokenSet.add(refreshToken);
    this.memory.set(userId, tokenSet);
  }

  async hasRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<boolean> {
    if (this.redis) {
      const isMember = await this.redis.sismember(
        this.key(userId),
        refreshToken,
      );
      return isMember === 1;
    }

    const tokenSet = this.memory.get(userId);
    return tokenSet?.has(refreshToken) ?? false;
  }

  async removeRefreshToken(
    userId: string,
    refreshToken?: string,
  ): Promise<void> {
    if (this.redis) {
      if (refreshToken) {
        await this.redis.srem(this.key(userId), refreshToken);
      } else {
        await this.redis.del(this.key(userId));
      }
      return;
    }

    if (!refreshToken) {
      this.memory.delete(userId);
      return;
    }

    const tokenSet = this.memory.get(userId);
    if (!tokenSet) {
      return;
    }
    tokenSet.delete(refreshToken);
    if (tokenSet.size === 0) {
      this.memory.delete(userId);
    }
  }

  private key(userId: string): string {
    return `auth:sessions:${userId}`;
  }
}
