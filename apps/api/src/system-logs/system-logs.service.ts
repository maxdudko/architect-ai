import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  SystemLog,
  SystemLogCategory,
  SystemLogLevel,
} from '@prisma/client';
import {
  SystemLogCreateInput,
  SystemLogListParams,
  SystemLogsRepository,
} from './system-logs.repository';

const SENSITIVE_METADATA_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'authorization',
  'secret',
  'apikey',
  'api_key',
  'openaiapikey',
  'openai_api_key',
  'anthropicapikey',
  'anthropic_api_key',
  'grokapikey',
  'grok_api_key',
  'geminiapikey',
  'gemini_api_key',
]);

@Injectable()
export class SystemLogsService {
  private readonly logger = new Logger(SystemLogsService.name);

  constructor(private readonly systemLogsRepository: SystemLogsRepository) {}

  record(input: SystemLogCreateInput): void {
    void this.persist(input);
  }

  async recordAsync(input: SystemLogCreateInput): Promise<SystemLog | null> {
    return this.persist(input);
  }

  findManyPaginated(
    params: SystemLogListParams,
  ): Promise<{ items: SystemLog[]; total: number }> {
    return this.systemLogsRepository.findManyPaginated(params);
  }

  levelFromStatusCode(statusCode: number): SystemLogLevel {
    if (statusCode >= 500) {
      return SystemLogLevel.ERROR;
    }
    if (statusCode >= 400) {
      return SystemLogLevel.WARN;
    }
    return SystemLogLevel.INFO;
  }

  private async persist(
    input: SystemLogCreateInput,
  ): Promise<SystemLog | null> {
    try {
      return await this.systemLogsRepository.create({
        ...input,
        category: input.category ?? SystemLogCategory.HTTP,
        metadata: this.sanitizeMetadata(input.metadata),
      });
    } catch (error) {
      this.logger.error(
        `Failed to record system log ${input.event}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private sanitizeMetadata(
    metadata: Prisma.InputJsonValue | null | undefined,
  ): Prisma.InputJsonValue | null {
    if (metadata == null) {
      return null;
    }
    if (typeof metadata !== 'object' || Array.isArray(metadata)) {
      return metadata;
    }

    const sanitized: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (SENSITIVE_METADATA_KEYS.has(key.toLowerCase())) {
        continue;
      }
      if (value === undefined) {
        continue;
      }
      sanitized[key] = value as Prisma.InputJsonValue;
    }
    return sanitized;
  }
}
