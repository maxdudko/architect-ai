import { Injectable, NotFoundException } from '@nestjs/common';
import {
  GuideGenerationStatus,
  GuideType,
  Prisma,
  RepositoryStatus,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { OnboardingGuideStorage } from '../interfaces/onboarding-guide-storage.interface';
import {
  CreateOnboardingGuideGenerationRunInput,
  OnboardingGuideGenerationRun,
  UpdateOnboardingGuideGenerationRunInput,
} from '../types/guide-generation-run.type';
import {
  OnboardingGuide,
  OnboardingGuideListFilters,
  ReplaceOnboardingGuideSetInput,
} from '../types/onboarding-guide.type';

@Injectable()
export class PrismaOnboardingGuideStorage implements OnboardingGuideStorage {
  constructor(private readonly prisma: PrismaService) {}

  async validateRepository(
    workspaceId: string,
    repositoryId: string,
  ): Promise<void> {
    await this.validateRepositoryWithClient(
      this.prisma,
      workspaceId,
      repositoryId,
    );
  }

  async validateRepositoryReady(
    workspaceId: string,
    repositoryId: string,
  ): Promise<void> {
    const repository = await this.prisma.repository.findFirst({
      where: {
        id: repositoryId,
        workspaceId,
        deletedAt: null,
      },
      select: { status: true },
    });
    if (!repository) {
      throw new NotFoundException('Repository not found in this workspace');
    }
    if (repository.status !== RepositoryStatus.READY) {
      throw new Error(
        `Repository must be READY before generating onboarding guides (current status: ${repository.status})`,
      );
    }
  }

  async listGuides(
    workspaceId: string,
    repositoryId: string,
    filters: OnboardingGuideListFilters = {},
  ): Promise<OnboardingGuide[]> {
    await this.validateRepository(workspaceId, repositoryId);

    const search = filters.search?.trim();
    return this.prisma.guide.findMany({
      where: {
        workspaceId,
        repositoryId,
        ...(filters.types ? { type: { in: filters.types } } : {}),
        ...(filters.slugs ? { slug: { in: filters.slugs } } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { slug: { contains: search, mode: 'insensitive' } },
                { summary: { contains: search, mode: 'insensitive' } },
                { markdown: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ type: 'asc' }, { slug: 'asc' }],
    });
  }

  async getGuide(
    workspaceId: string,
    repositoryId: string,
    guideId: string,
  ): Promise<OnboardingGuide | null> {
    await this.validateRepository(workspaceId, repositoryId);

    return this.prisma.guide.findFirst({
      where: {
        id: guideId,
        workspaceId,
        repositoryId,
      },
    });
  }

  async createGenerationRun(
    input: CreateOnboardingGuideGenerationRunInput,
  ): Promise<OnboardingGuideGenerationRun> {
    await this.validateRepository(input.workspaceId, input.repositoryId);

    return this.prisma.guideGenerationRun.create({
      data: {
        workspaceId: input.workspaceId,
        repositoryId: input.repositoryId,
        trigger: input.trigger,
        requestedTypes: input.requestedTypes,
        totalGuideCount: input.totalGuideCount ?? 0,
        sourceIndexingRunId: input.sourceIndexingRunId ?? null,
        sourceCommitSha: input.sourceCommitSha ?? null,
      },
    });
  }

  getGenerationRun(
    runId: string,
  ): Promise<OnboardingGuideGenerationRun | null> {
    return this.prisma.guideGenerationRun.findUnique({
      where: { id: runId },
    });
  }

  async updateGenerationRun(
    workspaceId: string,
    repositoryId: string,
    runId: string,
    input: UpdateOnboardingGuideGenerationRunInput,
  ): Promise<OnboardingGuideGenerationRun | null> {
    await this.validateRepository(workspaceId, repositoryId);

    const result = await this.prisma.guideGenerationRun.updateMany({
      where: {
        id: runId,
        workspaceId,
        repositoryId,
      },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.totalGuideCount !== undefined
          ? { totalGuideCount: input.totalGuideCount }
          : {}),
        ...(input.completedGuideCount !== undefined
          ? { completedGuideCount: input.completedGuideCount }
          : {}),
        ...(input.error !== undefined ? { error: input.error } : {}),
        ...(input.errors !== undefined
          ? { errors: input.errors === null ? Prisma.DbNull : input.errors }
          : {}),
        ...(input.startedAt !== undefined
          ? { startedAt: input.startedAt }
          : {}),
        ...(input.completedAt !== undefined
          ? { completedAt: input.completedAt }
          : {}),
      },
    });

    if (result.count === 0) {
      return null;
    }

    return this.prisma.guideGenerationRun.findFirst({
      where: {
        id: runId,
        workspaceId,
        repositoryId,
      },
    });
  }

  async findActiveGenerationRun(
    workspaceId: string,
    repositoryId: string,
  ): Promise<OnboardingGuideGenerationRun | null> {
    await this.validateRepository(workspaceId, repositoryId);

    return this.prisma.guideGenerationRun.findFirst({
      where: {
        workspaceId,
        repositoryId,
        status: {
          in: [GuideGenerationStatus.QUEUED, GuideGenerationStatus.RUNNING],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findLatestGenerationRun(
    workspaceId: string,
    repositoryId: string,
    statuses?: GuideGenerationStatus[],
  ): Promise<OnboardingGuideGenerationRun | null> {
    await this.validateRepository(workspaceId, repositoryId);

    return this.prisma.guideGenerationRun.findFirst({
      where: {
        workspaceId,
        repositoryId,
        ...(statuses ? { status: { in: statuses } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  replaceGuideSet(
    input: ReplaceOnboardingGuideSetInput,
  ): Promise<OnboardingGuide[]> {
    this.validateReplacement(input);

    return this.prisma.$transaction(async (transaction) => {
      await this.validateRepositoryWithClient(
        transaction,
        input.workspaceId,
        input.repositoryId,
      );

      for (const guide of input.guides) {
        await transaction.guide.upsert({
          where: {
            repositoryId_type_slug: {
              repositoryId: input.repositoryId,
              type: guide.type,
              slug: guide.slug,
            },
          },
          create: {
            workspaceId: input.workspaceId,
            repositoryId: input.repositoryId,
            type: guide.type,
            slug: guide.slug,
            title: guide.title,
            markdown: guide.markdown,
            summary: guide.summary ?? null,
            metadata: guide.metadata,
            sourceIndexingRunId: input.sourceIndexingRunId ?? null,
            sourceCommitSha: input.sourceCommitSha ?? null,
          },
          update: {
            workspaceId: input.workspaceId,
            title: guide.title,
            markdown: guide.markdown,
            summary: guide.summary ?? null,
            metadata: guide.metadata,
            sourceIndexingRunId: input.sourceIndexingRunId ?? null,
            sourceCommitSha: input.sourceCommitSha ?? null,
            generationVersion: { increment: 1 },
          },
        });
      }

      const generatedGuideKeys = input.guides.map((guide) => ({
        type: guide.type,
        slug: guide.slug,
      }));
      await transaction.guide.deleteMany({
        where: {
          workspaceId: input.workspaceId,
          repositoryId: input.repositoryId,
          type: { in: input.replacedTypes },
          ...(generatedGuideKeys.length > 0
            ? { NOT: { OR: generatedGuideKeys } }
            : {}),
        },
      });

      if (input.replacedTypes.length === 0) {
        return [];
      }

      return transaction.guide.findMany({
        where: {
          workspaceId: input.workspaceId,
          repositoryId: input.repositoryId,
          type: { in: input.replacedTypes },
        },
        orderBy: [{ type: 'asc' }, { slug: 'asc' }],
      });
    });
  }

  async deleteGuide(
    workspaceId: string,
    repositoryId: string,
    guideId: string,
  ): Promise<boolean> {
    await this.validateRepository(workspaceId, repositoryId);

    const result = await this.prisma.guide.deleteMany({
      where: {
        id: guideId,
        workspaceId,
        repositoryId,
      },
    });
    return result.count > 0;
  }

  async deleteGuides(
    workspaceId: string,
    repositoryId: string,
    types?: GuideType[],
  ): Promise<number> {
    await this.validateRepository(workspaceId, repositoryId);

    const result = await this.prisma.guide.deleteMany({
      where: {
        workspaceId,
        repositoryId,
        ...(types ? { type: { in: types } } : {}),
      },
    });
    return result.count;
  }

  private async validateRepositoryWithClient(
    client: Prisma.TransactionClient | PrismaService,
    workspaceId: string,
    repositoryId: string,
  ): Promise<void> {
    const repository = await client.repository.findFirst({
      where: {
        id: repositoryId,
        workspaceId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!repository) {
      throw new NotFoundException('Repository not found in this workspace');
    }
  }

  private validateReplacement(input: ReplaceOnboardingGuideSetInput): void {
    const replacedTypes = new Set(input.replacedTypes);
    const guideKeys = new Set<string>();

    for (const guide of input.guides) {
      if (!replacedTypes.has(guide.type)) {
        throw new Error(
          `Guide type ${guide.type} is not included in replacedTypes`,
        );
      }

      const key = `${guide.type}:${guide.slug}`;
      if (guideKeys.has(key)) {
        throw new Error(`Duplicate guide identity in replacement: ${key}`);
      }
      guideKeys.add(key);
    }
  }
}
