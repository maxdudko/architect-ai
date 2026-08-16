import { Injectable } from '@nestjs/common';
import { GuideType } from '@prisma/client';
import { RetrievalService } from '../../retrieval/retrieval.service';
import { WorkspaceLlmResolver } from '../../../workspace-ai/workspace-llm.resolver';
import { GuidePromptBuilder } from '../prompts/guide-prompt.builder';
import type {
  GuideGenerationContext,
  GuideGenerationTarget,
} from '../types/guide-generation.type';
import { stableSlug } from '../utils/guide-output.util';
import { RetrievalBackedGuideGenerator } from './retrieval-backed-guide.generator';

abstract class SingletonGuideGenerator extends RetrievalBackedGuideGenerator {
  protected abstract readonly defaultTitle: string;

  targets(): GuideGenerationTarget[] {
    return [
      {
        type: this.type,
        key: this.type,
        slug: stableSlug(this.defaultTitle),
        title: this.defaultTitle,
      },
    ];
  }
}

@Injectable()
export class ExecutiveSummaryGuideGenerator extends SingletonGuideGenerator {
  readonly type = GuideType.EXECUTIVE_SUMMARY;
  protected readonly defaultTitle = 'Executive Summary';

  constructor(
    retrievalService: RetrievalService,
    workspaceLlmResolver: WorkspaceLlmResolver,
    promptBuilder: GuidePromptBuilder,
  ) {
    super(retrievalService, workspaceLlmResolver, promptBuilder);
  }

  protected focusedQuery(context: GuideGenerationContext): string {
    return `Executive architecture summary of ${context.topology.repository.fullName}: purpose, major responsibilities, system boundaries, key flows, and material risks`;
  }
}

@Injectable()
export class ProjectOverviewGuideGenerator extends SingletonGuideGenerator {
  readonly type = GuideType.PROJECT_OVERVIEW;
  protected readonly defaultTitle = 'Project Overview';

  constructor(
    retrievalService: RetrievalService,
    workspaceLlmResolver: WorkspaceLlmResolver,
    promptBuilder: GuidePromptBuilder,
  ) {
    super(retrievalService, workspaceLlmResolver, promptBuilder);
  }

  protected focusedQuery(context: GuideGenerationContext): string {
    return `Project architecture overview for ${context.topology.repository.fullName}: entry points, core execution flows, module boundaries, and dependencies`;
  }
}

@Injectable()
export class FolderGuideGenerator extends SingletonGuideGenerator {
  readonly type = GuideType.FOLDER;
  protected readonly defaultTitle = 'Repository Folder Guide';

  constructor(
    retrievalService: RetrievalService,
    workspaceLlmResolver: WorkspaceLlmResolver,
    promptBuilder: GuidePromptBuilder,
  ) {
    super(retrievalService, workspaceLlmResolver, promptBuilder);
  }

  protected focusedQuery(context: GuideGenerationContext): string {
    const folders = context.topology.majorFolders
      .slice(0, 12)
      .map((folder) => folder.path)
      .join(', ');
    return `Conceptual responsibilities and relationships among major repository folders: ${folders}`;
  }
}

@Injectable()
export class ModuleGuideGenerator extends RetrievalBackedGuideGenerator {
  readonly type = GuideType.MODULE;

  constructor(
    retrievalService: RetrievalService,
    workspaceLlmResolver: WorkspaceLlmResolver,
    promptBuilder: GuidePromptBuilder,
  ) {
    super(retrievalService, workspaceLlmResolver, promptBuilder);
  }

  targets(context: GuideGenerationContext): GuideGenerationTarget[] {
    return context.topology.moduleCandidates.map((candidate) => ({
      type: this.type,
      key: candidate.key,
      slug: stableSlug(candidate.path),
      title: `${candidate.name} Module`,
      candidate,
    }));
  }

  protected focusedQuery(
    context: GuideGenerationContext,
    target: GuideGenerationTarget,
  ): string {
    return `Module ${target.candidate?.name ?? target.title} at ${target.candidate?.path}: purpose, public responsibilities, internal components, incoming and outgoing dependencies, and safe change boundaries in ${context.topology.repository.fullName}`;
  }
}

@Injectable()
export class ServiceGuideGenerator extends RetrievalBackedGuideGenerator {
  readonly type = GuideType.SERVICE;

  constructor(
    retrievalService: RetrievalService,
    workspaceLlmResolver: WorkspaceLlmResolver,
    promptBuilder: GuidePromptBuilder,
  ) {
    super(retrievalService, workspaceLlmResolver, promptBuilder);
  }

  targets(context: GuideGenerationContext): GuideGenerationTarget[] {
    return context.topology.serviceCandidates.map((candidate) => ({
      type: this.type,
      key: candidate.key,
      slug: stableSlug(candidate.key),
      title: candidate.name,
      candidate,
    }));
  }

  protected focusedQuery(
    context: GuideGenerationContext,
    target: GuideGenerationTarget,
  ): string {
    return `Service ${target.candidate?.name ?? target.title} at ${target.candidate?.path}: responsibility, callers, collaborators, inputs, outputs, side effects, failure behavior, and change hazards in ${context.topology.repository.fullName}`;
  }
}

@Injectable()
export class TechnologyStackGuideGenerator extends SingletonGuideGenerator {
  readonly type = GuideType.TECHNOLOGY_STACK;
  protected readonly defaultTitle = 'Technology Stack';

  constructor(
    retrievalService: RetrievalService,
    workspaceLlmResolver: WorkspaceLlmResolver,
    promptBuilder: GuidePromptBuilder,
  ) {
    super(retrievalService, workspaceLlmResolver, promptBuilder);
  }

  protected focusedQuery(context: GuideGenerationContext): string {
    const technologies = context.topology.technologyEvidence
      .map((item) => item.name)
      .join(', ');
    return `Technology stack and configuration evidence for ${context.topology.repository.fullName}; explain roles and interactions for: ${technologies}`;
  }
}

@Injectable()
export class ReadingOrderGuideGenerator extends SingletonGuideGenerator {
  readonly type = GuideType.READING_ORDER;
  protected readonly defaultTitle = 'Suggested Reading Order';

  constructor(
    retrievalService: RetrievalService,
    workspaceLlmResolver: WorkspaceLlmResolver,
    promptBuilder: GuidePromptBuilder,
  ) {
    super(retrievalService, workspaceLlmResolver, promptBuilder);
  }

  protected focusedQuery(context: GuideGenerationContext): string {
    return `Best progressive reading order for a new engineer in ${context.topology.repository.fullName}, beginning with entry points and public boundaries, then core modules and services`;
  }
}

@Injectable()
export class GlossaryGuideGenerator extends SingletonGuideGenerator {
  readonly type = GuideType.GLOSSARY;
  protected readonly defaultTitle = 'Project Glossary';

  constructor(
    retrievalService: RetrievalService,
    workspaceLlmResolver: WorkspaceLlmResolver,
    promptBuilder: GuidePromptBuilder,
  ) {
    super(retrievalService, workspaceLlmResolver, promptBuilder);
  }

  protected focusedQuery(context: GuideGenerationContext): string {
    return `Repository-specific domain vocabulary, architecture concepts, recurring symbol names, acronyms, and terms requiring definition in ${context.topology.repository.fullName}`;
  }
}

@Injectable()
export class CommonPitfallsGuideGenerator extends SingletonGuideGenerator {
  readonly type = GuideType.COMMON_PITFALLS;
  protected readonly defaultTitle = 'Common Pitfalls';

  constructor(
    retrievalService: RetrievalService,
    workspaceLlmResolver: WorkspaceLlmResolver,
    promptBuilder: GuidePromptBuilder,
  ) {
    super(retrievalService, workspaceLlmResolver, promptBuilder);
  }

  protected focusedQuery(context: GuideGenerationContext): string {
    return `Evidence-backed coupling, hidden dependencies, configuration assumptions, failure boundaries, and risky change patterns in ${context.topology.repository.fullName}`;
  }
}
