import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../../common/guards/workspace-param.guard';
import { MembershipsModule } from '../../memberships/memberships.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { RepositoriesModule } from '../../repositories/repositories.module';
import { UsageModule } from '../../usage/usage.module';
import { WorkspaceAiModule } from '../../workspace-ai/workspace-ai.module';
import type { GuideGenerator } from './interfaces/guide-generator.interface';
import {
  GUIDE_GENERATORS,
  GUIDE_TEMPLATE_CONTRACTS_PROVIDER,
  INDEXED_TOPOLOGY_DATA_SOURCE,
  ONBOARDING_GUIDE_STORAGE,
} from './interfaces/tokens';
import {
  CommonPitfallsGuideGenerator,
  ExecutiveSummaryGuideGenerator,
  FolderGuideGenerator,
  GlossaryGuideGenerator,
  ModuleGuideGenerator,
  ProjectOverviewGuideGenerator,
  ReadingOrderGuideGenerator,
  ServiceGuideGenerator,
  TechnologyStackGuideGenerator,
} from './generators/living-guide.generators';
import { GuideGeneratorRegistry } from './generators/guide-generator.registry';
import { IndexedTopologyAnalyzer } from './guides/indexed-topology-analyzer';
import { PrismaIndexedTopologyDataSource } from './guides/prisma-indexed-topology-data-source';
import { OnboardingGuideOrchestrator } from './onboarding-guide.orchestrator';
import { OnboardingGuidesController } from './onboarding-guides.controller';
import { OnboardingGuidesService } from './onboarding-guides.service';
import { GuidePromptBuilder } from './prompts/guide-prompt.builder';
import { RetrievalContextBuilder } from './prompts/retrieval-context.builder';
import { OnboardingGuideQueueService } from './queue/onboarding-guide-queue.service';
import { OnboardingGuideWorkerService } from './queue/onboarding-guide-worker.service';
import { PrismaOnboardingGuideStorage } from './storage/prisma-onboarding-guide-storage';
import { GUIDE_TEMPLATE_CONTRACTS } from './templates/guide-template.contract';

const GENERATOR_CLASSES = [
  ExecutiveSummaryGuideGenerator,
  ProjectOverviewGuideGenerator,
  FolderGuideGenerator,
  ModuleGuideGenerator,
  ServiceGuideGenerator,
  TechnologyStackGuideGenerator,
  ReadingOrderGuideGenerator,
  GlossaryGuideGenerator,
  CommonPitfallsGuideGenerator,
] as const;

@Module({
  imports: [
    ConfigModule,
    MembershipsModule,
    PrismaModule,
    RetrievalModule,
    UsageModule,
    WorkspaceAiModule,
    forwardRef(() => RepositoriesModule),
  ],
  controllers: [OnboardingGuidesController],
  providers: [
    JwtAuthGuard,
    WorkspaceParamGuard,
    RolesGuard,
    PrismaOnboardingGuideStorage,
    {
      provide: ONBOARDING_GUIDE_STORAGE,
      useExisting: PrismaOnboardingGuideStorage,
    },
    PrismaIndexedTopologyDataSource,
    {
      provide: INDEXED_TOPOLOGY_DATA_SOURCE,
      useExisting: PrismaIndexedTopologyDataSource,
    },
    RetrievalContextBuilder,
    GuidePromptBuilder,
    {
      provide: GUIDE_TEMPLATE_CONTRACTS_PROVIDER,
      useValue: GUIDE_TEMPLATE_CONTRACTS,
    },
    ...GENERATOR_CLASSES,
    {
      provide: GUIDE_GENERATORS,
      inject: [...GENERATOR_CLASSES],
      useFactory: (...generators: GuideGenerator[]): GuideGenerator[] =>
        generators,
    },
    GuideGeneratorRegistry,
    IndexedTopologyAnalyzer,
    OnboardingGuideOrchestrator,
    OnboardingGuidesService,
    OnboardingGuideQueueService,
    OnboardingGuideWorkerService,
  ],
  exports: [
    ONBOARDING_GUIDE_STORAGE,
    PrismaOnboardingGuideStorage,
    OnboardingGuideOrchestrator,
    OnboardingGuideQueueService,
  ],
})
export class OnboardingModule {}
