import {
  GuideGenerationStatus,
  GuideGenerationTrigger,
  GuideType,
} from '@prisma/client';
import { GuideGeneratorRegistry } from './generators/guide-generator.registry';
import { IndexedTopologyAnalyzer } from './guides/indexed-topology-analyzer';
import type { GuideGenerator } from './interfaces/guide-generator.interface';
import type { OnboardingGuideStorage } from './interfaces/onboarding-guide-storage.interface';
import { OnboardingGuideOrchestrator } from './onboarding-guide.orchestrator';
import type { OnboardingGuideGenerationRun } from './types/guide-generation-run.type';
import type {
  GuideGenerationResult,
  GuideGenerationTarget,
} from './types/guide-generation.type';
import type { RepositoryTopology } from './types/topology.type';

describe('OnboardingGuideOrchestrator', () => {
  const now = new Date('2026-07-31T12:00:00.000Z');
  const run: OnboardingGuideGenerationRun = {
    id: 'run-1',
    workspaceId: 'workspace-1',
    repositoryId: 'repository-1',
    trigger: GuideGenerationTrigger.MANUAL_GENERATE,
    status: GuideGenerationStatus.QUEUED,
    requestedTypes: [
      GuideType.GLOSSARY,
      GuideType.MODULE,
      GuideType.PROJECT_OVERVIEW,
    ],
    totalGuideCount: 0,
    completedGuideCount: 0,
    sourceIndexingRunId: null,
    sourceCommitSha: null,
    error: null,
    errors: null,
    createdAt: now,
    startedAt: null,
    completedAt: null,
    updatedAt: now,
  };
  const topology: RepositoryTopology = {
    repository: {
      id: run.repositoryId,
      workspaceId: run.workspaceId,
      name: 'architect-ai',
      fullName: 'acme/architect-ai',
      provider: 'github',
      defaultBranch: 'main',
      status: 'READY',
      lastIndexedAt: now,
    },
    counts: {
      files: 2,
      sourceLines: 20,
      symbols: 2,
      relations: 1,
      exportedSymbols: 2,
      asyncSymbols: 0,
      averageSymbolsPerFile: 1,
      relationDensity: 0.5,
    },
    complexity: 'small',
    majorFolders: [],
    moduleCandidates: [],
    serviceCandidates: [],
    entryPointHints: [],
    technologyEvidence: [],
    source: {
      indexingRunId: 'index-run-1',
      commitSha: 'abc123',
      branch: 'main',
      completedAt: now,
    },
  };

  let storage: jest.Mocked<OnboardingGuideStorage>;
  let analyzer: jest.Mocked<IndexedTopologyAnalyzer>;
  let registry: jest.Mocked<GuideGeneratorRegistry>;
  let generators: Map<GuideType, jest.Mocked<GuideGenerator>>;
  let orchestrator: OnboardingGuideOrchestrator;

  const target = (
    type: GuideType,
    key: string = type,
  ): GuideGenerationTarget => ({
    type,
    key,
    slug: key.toLowerCase().replaceAll('_', '-'),
    title: key,
  });

  const result = (item: GuideGenerationTarget): GuideGenerationResult => ({
    type: item.type,
    slug: item.slug,
    title: item.title,
    markdown: `# ${item.title}`,
    summary: `Summary for ${item.key}`,
    metadata: { key: item.key },
    citations: [],
    model: 'test-model',
  });

  beforeEach(() => {
    storage = {
      validateRepository: jest.fn().mockResolvedValue(undefined),
      validateRepositoryReady: jest.fn(),
      listGuides: jest.fn().mockResolvedValue([]),
      getGuide: jest.fn(),
      createGenerationRun: jest.fn(),
      getGenerationRun: jest.fn().mockResolvedValue(run),
      updateGenerationRun: jest
        .fn()
        .mockImplementation((_workspaceId, _repositoryId, _runId, update) =>
          Promise.resolve({
            ...run,
            ...update,
          }),
        ),
      findActiveGenerationRun: jest.fn(),
      findLatestGenerationRun: jest.fn(),
      replaceGuideSet: jest.fn().mockResolvedValue([]),
      deleteGuide: jest.fn(),
      deleteGuides: jest.fn(),
    };
    analyzer = {
      analyze: jest.fn().mockResolvedValue(topology),
    } as unknown as jest.Mocked<IndexedTopologyAnalyzer>;
    generators = new Map();
    for (const type of run.requestedTypes) {
      const targets =
        type === GuideType.MODULE
          ? [target(type, 'module-a'), target(type, 'module-b')]
          : [target(type)];
      generators.set(type, {
        type,
        targets: jest.fn().mockReturnValue(targets),
        generate: jest
          .fn()
          .mockImplementation((_context, item) =>
            Promise.resolve(result(item)),
          ),
      });
    }
    registry = {
      get: jest.fn((type: GuideType) => {
        const generator = generators.get(type);
        if (!generator) throw new Error(`Missing ${type}`);
        return generator;
      }),
      list: jest.fn(),
    } as unknown as jest.Mocked<GuideGeneratorRegistry>;
    orchestrator = new OnboardingGuideOrchestrator(storage, analyzer, registry);
  });

  it('runs non-synthesis guides first, reports progress, and replaces once', async () => {
    const completed = await orchestrator.execute(run.id);

    expect(completed.status).toBe(GuideGenerationStatus.SUCCEEDED);
    const generatedOrder = [
      ...generators.get(GuideType.MODULE)!.generate.mock.calls,
      ...generators.get(GuideType.PROJECT_OVERVIEW)!.generate.mock.calls,
      ...generators.get(GuideType.GLOSSARY)!.generate.mock.calls,
    ];
    const invocationOrder = generatedOrder.sort(
      (left, right) => left[1].key.localeCompare(right[1].key) || 0,
    );
    expect(registry.get.mock.calls.map(([type]) => type)).toEqual([
      GuideType.MODULE,
      GuideType.PROJECT_OVERVIEW,
      GuideType.GLOSSARY,
    ]);
    expect(invocationOrder).toHaveLength(4);
    expect(
      storage.updateGenerationRun.mock.calls.map((call) => call[3]),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: GuideGenerationStatus.RUNNING,
          completedGuideCount: 0,
        }),
        { totalGuideCount: 4, completedGuideCount: 0 },
        { completedGuideCount: 1 },
        { completedGuideCount: 2 },
        { completedGuideCount: 3 },
        { completedGuideCount: 4 },
        expect.objectContaining({
          status: GuideGenerationStatus.SUCCEEDED,
          completedGuideCount: 4,
        }),
      ]),
    );
    expect(storage.replaceGuideSet).toHaveBeenCalledTimes(1);
    expect(storage.replaceGuideSet).toHaveBeenCalledWith(
      expect.objectContaining({
        replacedTypes: run.requestedTypes,
        sourceIndexingRunId: topology.source.indexingRunId,
        sourceCommitSha: topology.source.commitSha,
        guides: expect.arrayContaining([
          expect.objectContaining({ type: GuideType.MODULE, slug: 'module-a' }),
          expect.objectContaining({ type: GuideType.GLOSSARY }),
        ]),
      }),
    );

    const glossaryContext = generators.get(GuideType.GLOSSARY)!.generate.mock
      .calls[0][0];
    expect(glossaryContext.priorGuides).toHaveLength(3);
  });

  it('does not replace prior guides when any generator fails', async () => {
    generators
      .get(GuideType.MODULE)!
      .generate.mockResolvedValueOnce(
        result(target(GuideType.MODULE, 'module-a')),
      )
      .mockRejectedValueOnce(new Error('LLM failed'));

    await expect(orchestrator.execute(run.id)).rejects.toThrow('LLM failed');

    expect(storage.replaceGuideSet).not.toHaveBeenCalled();
    expect(storage.updateGenerationRun).toHaveBeenLastCalledWith(
      run.workspaceId,
      run.repositoryId,
      run.id,
      expect.objectContaining({
        status: GuideGenerationStatus.FAILED,
        error: 'LLM failed',
        errors: [
          {
            message: 'LLM failed',
            guideType: GuideType.MODULE,
            targetKey: 'module-b',
          },
        ],
      }),
    );
  });

  it('fails before replacement when repository validation fails', async () => {
    storage.validateRepository.mockRejectedValue(new Error('repository gone'));

    await expect(orchestrator.execute(run.id)).rejects.toThrow(
      'repository gone',
    );

    expect(analyzer.analyze).not.toHaveBeenCalled();
    expect(storage.replaceGuideSet).not.toHaveBeenCalled();
    expect(storage.updateGenerationRun).toHaveBeenLastCalledWith(
      run.workspaceId,
      run.repositoryId,
      run.id,
      expect.objectContaining({ status: GuideGenerationStatus.FAILED }),
    );
  });

  it('records terminal worker failures but preserves succeeded runs', async () => {
    await orchestrator.recordTerminalFailure(run.id, new Error('worker died'));
    expect(storage.updateGenerationRun).toHaveBeenCalledWith(
      run.workspaceId,
      run.repositoryId,
      run.id,
      expect.objectContaining({
        status: GuideGenerationStatus.FAILED,
        errors: [{ message: 'worker died', source: 'worker' }],
      }),
    );

    storage.updateGenerationRun.mockClear();
    storage.getGenerationRun.mockResolvedValue({
      ...run,
      status: GuideGenerationStatus.SUCCEEDED,
    });
    await orchestrator.recordTerminalFailure(run.id, new Error('late failure'));
    expect(storage.updateGenerationRun).not.toHaveBeenCalled();
  });
});
