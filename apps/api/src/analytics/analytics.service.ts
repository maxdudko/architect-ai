import { Injectable, Logger } from '@nestjs/common';
import {
  AnalyticsEventType,
  Prisma,
  type AnalyticsEvent,
  type MessageSourceCitation,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RetrievedChunkReference } from '../modules/retrieval/types/retrieved-context.type';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordEvent(params: {
    type: AnalyticsEventType;
    workspaceId: string;
    actorUserId?: string | null;
    repositoryId?: string | null;
    payload?: Prisma.InputJsonValue | null;
  }): Promise<AnalyticsEvent | null> {
    try {
      return await this.prisma.analyticsEvent.create({
        data: {
          type: params.type,
          workspaceId: params.workspaceId,
          actorUserId: params.actorUserId ?? null,
          repositoryId: params.repositoryId ?? null,
          payload: params.payload ?? undefined,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to record analytics event ${params.type}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async recordSourceCitations(params: {
    messageId: string;
    workspaceId: string;
    sources: RetrievedChunkReference[];
  }): Promise<MessageSourceCitation[]> {
    if (params.sources.length === 0) {
      return [];
    }

    try {
      await this.prisma.messageSourceCitation.createMany({
        data: params.sources.map((source, index) => ({
          messageId: params.messageId,
          workspaceId: params.workspaceId,
          repositoryId: source.repositoryId,
          chunkId: source.chunkId,
          filePath: source.filePath,
          startLine: source.startLine,
          endLine: source.endLine,
          score: source.score,
          rank: index,
        })),
      });

      return this.prisma.messageSourceCitation.findMany({
        where: { messageId: params.messageId },
        orderBy: { rank: 'asc' },
      });
    } catch (error) {
      this.logger.error(
        `Failed to record source citations for message ${params.messageId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }
}
