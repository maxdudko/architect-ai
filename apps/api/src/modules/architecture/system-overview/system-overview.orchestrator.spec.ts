import { ArchitectureOverviewGenerationStatus } from '@prisma/client';
import type { RetrievedContext } from '../../retrieval/types/retrieved-context.type';
import type { DependencyGraph } from '../dependency-mapping/types/dependency-graph.type';
import { OverviewValidationError } from './overview-validation.error';
import { SystemOverviewOrchestrator } from './system-overview.orchestrator';
import { SystemOverviewPromptBuilder } from './system-overview-prompt.builder';
import { SYSTEM_OVERVIEW_HEADINGS } from './system-overview.constants';

const emptyRetrieval: RetrievedContext = {
  chunks: [],
  symbols: [],
  files: [],
  references: [],
};

const graph: DependencyGraph = {
  repositoryId: 'repo',
  indexingRunId: 'index-1',
  modules: [
    {
      key: 'src/billing',
      name: 'Billing',
      path: 'src/billing',
      fileCount: 2,
      symbolCount: 2,
      languages: ['typescript'],
      outgoingDependencyCount: 0,
      incomingDependencyCount: 0,
      internalRelationCount: 0,
      unresolvedRelationCount: 0,
      externalRelationCount: 0,
      significance: 4,
    },
  ],
  filePathsByModule: { 'src/billing': ['src/billing/invoice.ts'] },
  dependencies: [],
  unresolved: [],
  external: [],
  exclusions: [],
  nonDependencyRelationCounts: [],
  totals: {
    moduleCount: 1,
    dependencyCount: 0,
    resolvedRelationCount: 0,
    unresolvedRelationCount: 0,
    externalRelationCount: 0,
    internalRelationCount: 0,
    groupedFileCount: 2,
    excludedFileCount: 0,
  },
  partial: false,
  partialReasons: [],
};

function overviewMarkdown(path: string): string {
  return [
    '# Draft',
    ...SYSTEM_OVERVIEW_HEADINGS.flatMap((heading) => [
      `## ${heading}`,
      heading === 'Main Modules'
        ? `See \`${path}\`.`
        : 'Observed from the index.',
    ]),
  ].join('\n\n');
}

describe('SystemOverviewOrchestrator', () => {
  function createOrchestrator(content: string) {
    const transaction = jest.fn();
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      architectureOverviewGenerationRun: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'run-1',
          workspaceId: 'workspace-1',
          repositoryId: 'repo-1',
          status: ArchitectureOverviewGenerationStatus.QUEUED,
          startedAt: null,
        }),
        update: jest.fn().mockResolvedValue({}),
        updateMany,
      },
      architectureOverview: {
        findUnique: jest.fn(),
      },
      $transaction: transaction.mockImplementation(
        (callback: (tx: unknown) => unknown) =>
          callback({
            architectureOverview: {
              findUnique: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue({}),
              update: jest.fn().mockResolvedValue({}),
            },
            architectureOverviewGenerationRun: {
              update: jest.fn().mockResolvedValue({}),
            },
          }),
      ),
    };
    const dataSource = {
      findRepositoryInWorkspace: jest.fn().mockResolvedValue({
        id: 'repo-1',
        status: 'READY',
        fullName: 'acme/app',
      }),
      findLatestSucceededRevision: jest.fn().mockResolvedValue({
        indexingRunId: 'index-1',
        branch: 'main',
        commitSha: 'abc',
        completedAt: new Date('2026-09-02T00:00:00.000Z'),
      }),
      listFileInventory: jest.fn().mockResolvedValue([
        { path: 'src/billing/invoice.ts', language: 'typescript' },
        { path: 'src/billing/tax.ts', language: 'typescript' },
      ]),
      listExistingPaths: jest
        .fn()
        .mockImplementation(
          (_repositoryId: string, _runId: string, paths: string[]) =>
            Promise.resolve(
              paths.filter((path) => path === 'src/billing/invoice.ts'),
            ),
        ),
    };
    const retrieval = {
      retrieve: jest.fn().mockResolvedValue(emptyRetrieval),
    };
    const orchestrator = new SystemOverviewOrchestrator(
      prisma as never,
      dataSource as never,
      { getGraph: jest.fn().mockResolvedValue(graph) } as never,
      retrieval as never,
      {
        resolve: jest.fn().mockResolvedValue({
          name: 'scripted',
          generate: jest.fn().mockResolvedValue({ content, model: 'scripted' }),
        }),
      } as never,
      new SystemOverviewPromptBuilder(),
    );
    return { orchestrator, transaction, updateMany, retrieval };
  }

  it('does not replace the current overview when a cited path is missing', async () => {
    const { orchestrator, transaction, updateMany } = createOrchestrator(
      overviewMarkdown('missing/file.ts'),
    );

    await expect(orchestrator.execute('run-1')).rejects.toBeInstanceOf(
      OverviewValidationError,
    );
    expect(transaction).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ArchitectureOverviewGenerationStatus.FAILED,
          error:
            'The generated overview cited paths that are not in this indexing revision: missing/file.ts.',
        }),
      }),
    );
  });

  it('stores the overview only after the cited paths exist in the selected revision', async () => {
    const { orchestrator, transaction, retrieval } = createOrchestrator(
      overviewMarkdown('src/billing/invoice.ts'),
    );

    await orchestrator.execute('run-1');

    expect(retrieval.retrieve).toHaveBeenCalledWith(
      expect.objectContaining({ indexingRunIds: ['index-1'] }),
    );
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
