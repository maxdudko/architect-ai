import { GuideType } from '@prisma/client';
import type {
  LlmGenerateRequest,
  LlmProvider,
} from '../../llm/interfaces/llm-provider.interface';
import { RetrievalService } from '../../retrieval/retrieval.service';
import { GuidePromptBuilder } from '../prompts/guide-prompt.builder';
import { RetrievalContextBuilder } from '../prompts/retrieval-context.builder';
import { GUIDE_TEMPLATE_CONTRACTS } from '../templates/guide-template.contract';
import type { GuideGenerationContext } from '../types/guide-generation.type';
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
} from './living-guide.generators';
import type { RetrievalBackedGuideGenerator } from './retrieval-backed-guide.generator';

describe('living guide generators', () => {
  const context: GuideGenerationContext = {
    workspaceId: 'workspace-1',
    repositoryId: 'repository-1',
    topology: {
      repository: {
        id: 'repository-1',
        workspaceId: 'workspace-1',
        name: 'architect-ai',
        fullName: 'acme/architect-ai',
        provider: 'github',
        defaultBranch: 'main',
        status: 'READY',
        lastIndexedAt: null,
      },
      counts: {
        files: 3,
        sourceLines: 100,
        symbols: 2,
        relations: 1,
        exportedSymbols: 2,
        asyncSymbols: 0,
        averageSymbolsPerFile: 0.67,
        relationDensity: 0.5,
      },
      complexity: 'small',
      majorFolders: [
        {
          path: 'src/billing',
          fileCount: 2,
          lineCount: 80,
          symbolCount: 2,
          relationCount: 1,
          score: 10,
        },
      ],
      moduleCandidates: [
        {
          key: 'src/billing',
          name: 'Billing',
          path: 'src/billing',
          evidencePaths: ['src/billing/billing.module.ts'],
          score: 20,
          reasons: ['module'],
        },
      ],
      serviceCandidates: [
        {
          key: 'BillingService',
          name: 'BillingService',
          path: 'src/billing/billing.service.ts',
          evidencePaths: ['src/billing/billing.service.ts'],
          score: 15,
          reasons: ['service'],
        },
      ],
      entryPointHints: [
        {
          path: 'src/main.ts',
          confidence: 'high',
          evidence: 'conventional entry point',
        },
      ],
      technologyEvidence: [
        {
          name: 'NestJS',
          category: 'framework',
          confidence: 'high',
          evidencePaths: ['nest-cli.json'],
          evidence: 'manifest',
        },
      ],
      source: {
        indexingRunId: 'index-run-1',
        commitSha: 'abc123',
        branch: 'main',
        completedAt: null,
      },
    },
  };

  let retrieval: jest.Mocked<RetrievalService>;
  let llm: jest.Mocked<LlmProvider>;
  let generators: RetrievalBackedGuideGenerator[];

  beforeEach(() => {
    retrieval = {
      retrieve: jest.fn().mockResolvedValue({
        chunks: [
          {
            id: 'chunk-1',
            repositoryId: context.repositoryId,
            fileId: 'file-1',
            symbolId: null,
            filePath: 'src/main.ts',
            content: 'bootstrap();',
            tokenCount: 3,
            startLine: 1,
            endLine: 1,
            language: 'TypeScript',
            symbolName: null,
            qualifiedName: null,
            symbolType: null,
            score: 0.9,
          },
        ],
        symbols: [],
        files: [],
        references: [
          {
            chunkId: 'chunk-1',
            repositoryId: context.repositoryId,
            filePath: 'src/main.ts',
            symbolName: null,
            qualifiedName: null,
            startLine: 1,
            endLine: 1,
            score: 0.9,
          },
        ],
      }),
    } as unknown as jest.Mocked<RetrievalService>;
    llm = {
      name: 'mock-provider',
      generate: jest.fn().mockImplementation((request: LlmGenerateRequest) => {
        const requiredLine = request.messages[1].content
          .split('\n')
          .find((line) => line.startsWith('Required H2 headings:'));
        const headings = requiredLine
          ?.replace('Required H2 headings: ', '')
          .split(' | ');
        return Promise.resolve({
          content:
            headings
              ?.map((heading) => `## ${heading}\nEvidence for ${heading}.`)
              .join('\n\n') ?? '',
          model: 'mock-model',
        });
      }),
      stream: jest.fn(),
    };
    const promptBuilder = new GuidePromptBuilder(new RetrievalContextBuilder());
    generators = [
      new ExecutiveSummaryGuideGenerator(retrieval, llm, promptBuilder),
      new ProjectOverviewGuideGenerator(retrieval, llm, promptBuilder),
      new FolderGuideGenerator(retrieval, llm, promptBuilder),
      new ModuleGuideGenerator(retrieval, llm, promptBuilder),
      new ServiceGuideGenerator(retrieval, llm, promptBuilder),
      new TechnologyStackGuideGenerator(retrieval, llm, promptBuilder),
      new ReadingOrderGuideGenerator(retrieval, llm, promptBuilder),
      new GlossaryGuideGenerator(retrieval, llm, promptBuilder),
      new CommonPitfallsGuideGenerator(retrieval, llm, promptBuilder),
    ];
  });

  it('provides exactly one registered implementation for every guide type', () => {
    expect(generators.map((generator) => generator.type).sort()).toEqual(
      Object.values(GuideType).sort(),
    );
  });

  it.each(Object.values(GuideType))(
    'retrieves and generates normalized %s output',
    async (type) => {
      const generator = generators.find((item) => item.type === type)!;
      const targets = generator.targets(context);

      expect(targets).toHaveLength(1);
      expect(targets[0].type).toBe(type);
      if (type === GuideType.MODULE) {
        expect(targets[0]).toEqual(
          expect.objectContaining({
            key: 'src/billing',
            slug: 'src-billing',
            title: 'Billing Module',
          }),
        );
      }
      if (type === GuideType.SERVICE) {
        expect(targets[0]).toEqual(
          expect.objectContaining({
            key: 'BillingService',
            slug: 'billingservice',
            title: 'BillingService',
          }),
        );
      }

      const output = await generator.generate(context, targets[0]);

      expect(retrieval.retrieve).toHaveBeenLastCalledWith({
        workspaceId: context.workspaceId,
        repositoryIds: [context.repositoryId],
        query: expect.any(String),
        topK: 14,
      });
      const retrievalQuery = retrieval.retrieve.mock.calls.at(-1)?.[0].query;
      expect(retrievalQuery?.length).toBeGreaterThan(20);
      expect(llm.generate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          maxTokens: 2_500,
          temperature: 0.2,
          messages: expect.any(Array),
        }),
      );
      expect(output).toEqual(
        expect.objectContaining({
          type,
          slug: targets[0].slug,
          title: targets[0].title,
          model: 'mock-model',
          citations: expect.arrayContaining([
            expect.objectContaining({ filePath: 'src/main.ts' }),
          ]),
          metadata: expect.objectContaining({
            targetKey: targets[0].key,
            sourceIndexingRunId: 'index-run-1',
            sourceCommitSha: 'abc123',
            evidencePaths: ['src/main.ts'],
            provider: 'mock-provider',
            model: 'mock-model',
          }),
        }),
      );
      expect(output.markdown.startsWith(`# ${targets[0].title}\n`)).toBe(true);
      for (const heading of GUIDE_TEMPLATE_CONTRACTS[type].headings) {
        expect(output.markdown).toContain(`## ${heading}`);
      }
      expect(output.summary).not.toBe('');
    },
  );

  it('rejects a target owned by another generator before retrieval', async () => {
    const generator = generators.find(
      (item) => item.type === GuideType.PROJECT_OVERVIEW,
    )!;

    await expect(
      generator.generate(context, {
        type: GuideType.GLOSSARY,
        key: 'wrong',
        slug: 'wrong',
        title: 'Wrong',
      }),
    ).rejects.toThrow('cannot generate');
    expect(retrieval.retrieve).not.toHaveBeenCalled();
  });
});
