import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class AdminSessionStoreService implements OnModuleDestroy {
  private readonly logger = new Logger(AdminSessionStoreService.name);
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
          `Redis unavailable for admin session store, fallback to memory: ${String(error)}`,
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

  async addRefreshToken(adminId: string, refreshToken: string): Promise<void> {
    if (this.redis) {
      await this.redis.sadd(this.key(adminId), refreshToken);
      await this.redis.expire(this.key(adminId), 60 * 60 * 24 * 30);
      return;
    }

    const tokenSet = this.memory.get(adminId) ?? new Set<string>();
    tokenSet.add(refreshToken);
    this.memory.set(adminId, tokenSet);
  }

  async hasRefreshToken(
    adminId: string,
    refreshToken: string,
  ): Promise<boolean> {
    if (this.redis) {
      const isMember = await this.redis.sismember(
        this.key(adminId),
        refreshToken,
      );
      return isMember === 1;
    }

    const tokenSet = this.memory.get(adminId);
    return tokenSet?.has(refreshToken) ?? false;
  }

  async removeRefreshToken(
    adminId: string,
    refreshToken?: string,
  ): Promise<void> {
    if (this.redis) {
      if (refreshToken) {
        await this.redis.srem(this.key(adminId), refreshToken);
      } else {
        await this.redis.del(this.key(adminId));
      }
      return;
    }

    if (!refreshToken) {
      this.memory.delete(adminId);
      return;
    }

    const tokenSet = this.memory.get(adminId);
    if (!tokenSet) {
      return;
    }
    tokenSet.delete(refreshToken);
    if (tokenSet.size === 0) {
      this.memory.delete(adminId);
    }
  }

  private key(adminId: string): string {
    return `auth:admin:sessions:${adminId}`;
  }
}
