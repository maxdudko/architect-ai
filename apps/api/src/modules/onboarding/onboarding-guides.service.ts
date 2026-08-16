import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GuideType, UsageMetric } from '@prisma/client';
import { GenerationRunResponseDto } from './dto/generation-run-response.dto';
import {
  OnboardingGuideListResponseDto,
  OnboardingGuideResponseDto,
} from './dto/onboarding-guide-response.dto';
import type { OnboardingGuideStorage } from './interfaces/onboarding-guide-storage.interface';
import { ONBOARDING_GUIDE_STORAGE } from './interfaces/tokens';
import { OnboardingGuideQueueService } from './queue/onboarding-guide-queue.service';
import { RepositoryAccessValidationService } from '../../repositories/repository-access-validation.service';
import { UsageService } from '../../usage/usage.service';
import type { OnboardingGuideGenerationRun } from './types/guide-generation-run.type';
import type { OnboardingGuide } from './types/onboarding-guide.type';

@Injectable()
export class OnboardingGuidesService {
  constructor(
    @Inject(ONBOARDING_GUIDE_STORAGE)
    private readonly storage: OnboardingGuideStorage,
    private readonly queue: OnboardingGuideQueueService,
    private readonly repositoryAccessValidationService: RepositoryAccessValidationService,
    private readonly usageService: UsageService,
  ) {}

  async listGuides(
    workspaceId: string,
    repositoryId: string,
    _userId: string,
    type?: GuideType,
    search?: string,
  ): Promise<OnboardingGuideListResponseDto> {
    const guides = await this.storage.listGuides(workspaceId, repositoryId, {
      ...(type ? { types: [type] } : {}),
      ...(search?.trim() ? { search: search.trim() } : {}),
    });

    return {
      guides: guides.map((guide) => this.toGuideResponse(guide)),
      total: guides.length,
    };
  }

  async getGuide(
    workspaceId: string,
    repositoryId: string,
    guideId: string,
    _userId: string,
  ): Promise<OnboardingGuideResponseDto> {
    const guide = await this.storage.getGuide(
      workspaceId,
      repositoryId,
      guideId,
    );
    if (!guide) {
      throw new NotFoundException('Onboarding guide not found');
    }
    return this.toGuideResponse(guide);
  }

  async getLatestGenerationRun(
    workspaceId: string,
    repositoryId: string,
    _userId: string,
  ): Promise<GenerationRunResponseDto | null> {
    const run = await this.storage.findLatestGenerationRun(
      workspaceId,
      repositoryId,
    );
    return run ? this.toGenerationRunResponse(run) : null;
  }

  generateGuides(
    workspaceId: string,
    repositoryId: string,
    userId: string,
    requestedTypes?: GuideType[],
  ): Promise<GenerationRunResponseDto> {
    return this.enqueueGeneration(
      workspaceId,
      repositoryId,
      userId,
      requestedTypes,
      false,
    );
  }

  regenerateGuides(
    workspaceId: string,
    repositoryId: string,
    userId: string,
    requestedTypes?: GuideType[],
  ): Promise<GenerationRunResponseDto> {
    return this.enqueueGeneration(
      workspaceId,
      repositoryId,
      userId,
      requestedTypes,
      true,
    );
  }

  private async enqueueGeneration(
    workspaceId: string,
    repositoryId: string,
    userId: string,
    requestedTypes: GuideType[] | undefined,
    regenerate: boolean,
  ): Promise<GenerationRunResponseDto> {
    await this.assertRepositoryAccess(workspaceId, repositoryId, userId);
    await this.assertRepositoryReady(workspaceId, repositoryId);

    const active = await this.storage.findActiveGenerationRun(
      workspaceId,
      repositoryId,
    );
    if (active) {
      return this.toGenerationRunResponse(active);
    }

    await this.usageService.assertWithinLimit(
      workspaceId,
      UsageMetric.GUIDE_GENERATIONS,
    );

    try {
      await this.queue.waitUntilReady();
    } catch (error) {
      throw new ServiceUnavailableException(this.errorMessage(error));
    }

    try {
      const request = { workspaceId, repositoryId, requestedTypes };
      const run = regenerate
        ? await this.queue.enqueueManualRegenerate(request)
        : await this.queue.enqueueManualGenerate(request);
      return this.toGenerationRunResponse(run);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const message = this.errorMessage(error);
      if (message.includes('must be READY')) {
        throw new ConflictException(message);
      }
      if (
        message.includes('At least one onboarding guide type') ||
        message.includes('Unsupported onboarding guide type')
      ) {
        throw new BadRequestException(message);
      }
      throw new ServiceUnavailableException(message);
    }
  }

  private async assertRepositoryReady(
    workspaceId: string,
    repositoryId: string,
  ): Promise<void> {
    try {
      await this.storage.validateRepositoryReady(workspaceId, repositoryId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = this.errorMessage(error);
      if (message.includes('must be READY')) {
        throw new ConflictException(message);
      }
      throw new ServiceUnavailableException(message);
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error
      ? error.message
      : 'Onboarding guide generation is unavailable';
  }

  private async assertRepositoryAccess(
    workspaceId: string,
    repositoryId: string,
    userId: string,
  ): Promise<void> {
    await this.repositoryAccessValidationService.assertUserCanAccessRepository({
      workspaceId,
      repositoryId,
      userId,
    });
  }

  private toGuideResponse(guide: OnboardingGuide): OnboardingGuideResponseDto {
    return {
      id: guide.id,
      workspaceId: guide.workspaceId,
      repositoryId: guide.repositoryId,
      type: guide.type,
      slug: guide.slug,
      title: guide.title,
      markdown: guide.markdown,
      summary: guide.summary,
      metadata: guide.metadata,
      generationVersion: guide.generationVersion,
      sourceIndexingRunId: guide.sourceIndexingRunId,
      sourceCommitSha: guide.sourceCommitSha,
      createdAt: guide.createdAt.toISOString(),
      updatedAt: guide.updatedAt.toISOString(),
    };
  }

  private toGenerationRunResponse(
    run: OnboardingGuideGenerationRun,
  ): GenerationRunResponseDto {
    return {
      id: run.id,
      workspaceId: run.workspaceId,
      repositoryId: run.repositoryId,
      trigger: run.trigger,
      status: run.status,
      requestedTypes: run.requestedTypes,
      totalGuideCount: run.totalGuideCount,
      completedGuideCount: run.completedGuideCount,
      sourceIndexingRunId: run.sourceIndexingRunId,
      sourceCommitSha: run.sourceCommitSha,
      error: run.error,
      errors: run.errors,
      createdAt: run.createdAt.toISOString(),
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
      updatedAt: run.updatedAt.toISOString(),
    };
  }
}
