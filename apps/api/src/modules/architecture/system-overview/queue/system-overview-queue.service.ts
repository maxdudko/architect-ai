import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ArchitectureOverviewGenerationStatus,
  ArchitectureOverviewGenerationTrigger,
  Prisma,
} from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  OVERVIEW_GENERATION_FAILED_MESSAGE,
  SYSTEM_OVERVIEW_JOB_NAME,
  SYSTEM_OVERVIEW_LIMITS,
} from '../system-overview.constants';
import {
  getDefaultSystemOverviewJobOptions,
  getSystemOverviewQueueName,
  getSystemOverviewRedisConnection,
  systemOverviewQueueDriver,
} from './system-overview-queue.config';

export interface SystemOverviewJobData {
  runId: string;
  workspaceId: string;
  repositoryId: string;
}

@Injectable()
export class SystemOverviewQueueService {
  private readonly logger = new Logger(SystemOverviewQueueService.name);
  private readonly driver: 'redis' | 'memory';
  private queue: Queue<SystemOverviewJobData> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.driver = systemOverviewQueueDriver(configService);
  }

  async enqueue(input: {
    workspaceId: string;
    repositoryId: string;
    trigger: ArchitectureOverviewGenerationTrigger;
  }) {
    if (this.driver === 'redis') {
      this.requireQueue();
    }

    try {
      const run = await this.prisma.architectureOverviewGenerationRun.create({
        data: {
          workspaceId: input.workspaceId,
          repositoryId: input.repositoryId,
          trigger: input.trigger,
          status: ArchitectureOverviewGenerationStatus.QUEUED,
          completedStep: 0,
          totalSteps: SYSTEM_OVERVIEW_LIMITS.totalSteps,
        },
      });

      if (this.driver === 'memory') {
        return run;
      }

      try {
        const queue = this.requireQueue();
        await queue.add(
          SYSTEM_OVERVIEW_JOB_NAME,
          {
            runId: run.id,
            workspaceId: run.workspaceId,
            repositoryId: run.repositoryId,
          },
          {
            ...getDefaultSystemOverviewJobOptions(),
            jobId: `architecture-overview__${run.id}`,
          },
        );
        return run;
      } catch (error) {
        const message = OVERVIEW_GENERATION_FAILED_MESSAGE;
        this.logger.error(
          `Could not enqueue architecture overview run ${run.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        await this.prisma.architectureOverviewGenerationRun.update({
          where: { id: run.id },
          data: {
            status: ArchitectureOverviewGenerationStatus.FAILED,
            error: message,
            completedAt: new Date(),
          },
        });
        throw new Error('Architecture overview queue is unavailable', {
          cause: error,
        });
      }
    } catch (error) {
      if (!isActiveRunConflict(error)) {
        throw error;
      }
      const active =
        await this.prisma.architectureOverviewGenerationRun.findFirst({
          where: {
            workspaceId: input.workspaceId,
            repositoryId: input.repositoryId,
            status: {
              in: [
                ArchitectureOverviewGenerationStatus.QUEUED,
                ArchitectureOverviewGenerationStatus.RUNNING,
              ],
            },
          },
          orderBy: { createdAt: 'desc' },
        });
      if (!active) {
        throw error;
      }
      return active;
    }
  }

  private requireQueue(): Queue<SystemOverviewJobData> {
    if (!this.queue) {
      this.queue = new Queue<SystemOverviewJobData>(
        getSystemOverviewQueueName(),
        getSystemOverviewRedisConnection(this.configService),
      );
    }
    return this.queue;
  }
}

function isActiveRunConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
