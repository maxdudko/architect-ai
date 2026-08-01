import { GuideType } from '@prisma/client';
import { IndexedTopologyAnalyzer } from './guides/indexed-topology-analyzer';
import type { IndexedTopologyDataSource } from './interfaces/indexed-topology-data-source.interface';
import { GuidePromptBuilder } from './prompts/guide-prompt.builder';
import { RetrievalContextBuilder } from './prompts/retrieval-context.builder';
import { GUIDE_TEMPLATE_CONTRACTS } from './templates/guide-template.contract';
import type {
  IndexedTopologySnapshot,
  RepositoryTopology,
} from './types/topology.type';
import {
  deriveGuideSummary,
  normalizeGuideMarkdown,
  stableSlug,
} from './utils/guide-output.util';

describe('IndexedTopologyAnalyzer', () => {
  it('discovers ranked module, service, entry point, and technology candidates', async () => {
    const snapshot: IndexedTopologySnapshot = {
      repository: {
        id: 'repository-1',
        workspaceId: 'workspace-1',
        name: 'api',
        fullName: 'acme/api',
        provider: 'github',
        defaultBranch: 'main',
        status: 'READY',
        lastIndexedAt: null,
      },
      run: {
        indexingRunId: 'index-run-1',
        commitSha: 'abc123',
        branch: 'main',
        completedAt: new Date('2026-07-31T12:00:00.000Z'),
      },
      files: [
        {
          path: 'src/billing/billing.module.ts',
          language: 'TypeScript',
          extension: '.ts',
          lineCount: 100,
          size: 1_000,
        },
        {
          path: 'src/billing/billing.service.ts',
          language: 'TypeScript',
          extension: '.ts',
          lineCount: 80,
          size: 800,
        },
        {
          path: 'src/main.ts',
          language: 'TypeScript',
          extension: '.ts',
          lineCount: 20,
          size: 200,
        },
        {
          path: 'src/spec/ignored.spec.ts',
          language: 'TypeScript',
          extension: '.ts',
          lineCount: 50,
          size: 500,
        },
        {
          path: 'package.json',
          language: 'JSON',
          extension: '.json',
          lineCount: 30,
          size: 300,
        },
        {
          path: 'nest-cli.json',
          language: 'JSON',
          extension: '.json',
          lineCount: 10,
          size: 100,
        },
        {
          path: 'prisma/schema.prisma',
          language: 'Prisma',
          extension: '.prisma',
          lineCount: 40,
          size: 400,
        },
      ],
      symbols: [
        {
          filePath: 'src/billing/billing.module.ts',
          name: 'BillingModule',
          qualifiedName: 'BillingModule',
          type: 'MODULE',
          exported: true,
          isAsync: false,
        },
        {
          filePath: 'src/billing/billing.service.ts',
          name: 'BillingService',
          qualifiedName: 'BillingService',
          type: 'CLASS',
          exported: true,
          isAsync: false,
        },
      ],
      relations: [
        {
          fromFilePath: 'src/main.ts',
          type: 'IMPORTS',
          targetFilePath: 'src/billing/billing.module.ts',
          targetQualifiedName: 'BillingModule',
        },
        {
          fromFilePath: 'src/billing/billing.module.ts',
          type: 'CALLS',
          targetFilePath: 'src/billing/billing.service.ts',
          targetQualifiedName: 'BillingService',
        },
      ],
    };
    const dataSource = {
      loadLatest: jest.fn().mockResolvedValue(snapshot),
    } as jest.Mocked<IndexedTopologyDataSource>;

    const topology = await new IndexedTopologyAnalyzer(dataSource).analyze(
      'workspace-1',
      'repository-1',
    );

    expect(dataSource.loadLatest).toHaveBeenCalledWith(
      'workspace-1',
      'repository-1',
    );
    expect(topology.moduleCandidates[0]).toEqual(
      expect.objectContaining({
        key: 'src/billing',
        name: 'Billing',
        score: expect.any(Number),
      }),
    );
    expect(
      topology.moduleCandidates.some((item) => item.key.includes('spec')),
    ).toBe(false);
    expect(topology.serviceCandidates[0]).toEqual(
      expect.objectContaining({
        key: 'BillingService',
        path: 'src/billing/billing.service.ts',
      }),
    );
    expect(topology.entryPointHints).toEqual([
      expect.objectContaining({ path: 'src/main.ts', confidence: 'high' }),
    ]);
    expect(topology.technologyEvidence.map((item) => item.name)).toEqual(
      expect.arrayContaining([
        'NestJS',
        'Node.js package ecosystem',
        'Prisma',
        'TypeScript',
      ]),
    );
    expect(topology.counts).toEqual(
      expect.objectContaining({
        files: 7,
        sourceLines: 330,
        symbols: 2,
        relations: 2,
        exportedSymbols: 2,
        averageSymbolsPerFile: 0.29,
        relationDensity: 1,
      }),
    );
  });
});

describe('guide prompt and output contracts', () => {
  const topology: RepositoryTopology = {
    repository: {
      id: 'repository-1',
      workspaceId: 'workspace-1',
      name: 'api',
      fullName: 'acme/api',
      provider: 'github',
      defaultBranch: 'main',
      status: 'READY',
      lastIndexedAt: null,
    },
    counts: {
      files: 1,
      sourceLines: 10,
      symbols: 1,
      relations: 0,
      exportedSymbols: 1,
      asyncSymbols: 0,
      averageSymbolsPerFile: 1,
      relationDensity: 0,
    },
    complexity: 'small',
    majorFolders: [],
    moduleCandidates: [],
    serviceCandidates: [],
    entryPointHints: [],
    technologyEvidence: [],
    source: {
      indexingRunId: 'index-run-1',
      commitSha: 'abc',
      branch: 'main',
      completedAt: null,
    },
  };

  it('defines a complete, internally consistent contract for every guide type', () => {
    expect(Object.keys(GUIDE_TEMPLATE_CONTRACTS).sort()).toEqual(
      Object.values(GuideType).sort(),
    );
    for (const type of Object.values(GuideType)) {
      const contract = GUIDE_TEMPLATE_CONTRACTS[type];
      expect(contract.type).toBe(type);
      expect(contract.title).not.toBe('');
      expect(contract.objective).not.toBe('');
      expect(contract.headings.length).toBeGreaterThanOrEqual(3);
      expect(new Set(contract.headings).size).toBe(contract.headings.length);
    }
  });

  it('builds an evidence-constrained prompt with ordered headings and prior summaries', () => {
    const builder = new GuidePromptBuilder(new RetrievalContextBuilder());
    const contract = GUIDE_TEMPLATE_CONTRACTS[GuideType.PROJECT_OVERVIEW];
    const messages = builder.build({
      context: {
        workspaceId: 'workspace-1',
        repositoryId: 'repository-1',
        topology,
        priorGuides: [
          {
            type: GuideType.EXECUTIVE_SUMMARY,
            slug: 'executive-summary',
            title: 'Executive Summary',
            summary: 'Prior evidence summary',
          },
        ],
      },
      target: {
        type: GuideType.PROJECT_OVERVIEW,
        key: 'overview',
        slug: 'project-overview',
        title: 'Project Overview',
      },
      contract,
      focusedQuery: 'architecture and flows',
      retrievedContext: {
        chunks: [
          {
            id: 'chunk-1',
            repositoryId: 'repository-1',
            fileId: 'file-1',
            symbolId: null,
            filePath: 'src/main.ts',
            content: 'bootstrap();',
            tokenCount: 3,
            startLine: 10,
            endLine: 12,
            language: 'TypeScript',
            symbolName: null,
            qualifiedName: null,
            symbolType: null,
            score: 1,
          },
        ],
        symbols: [],
        files: [],
        references: [],
      },
    });

    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('Return Markdown only');
    expect(messages[0].content).toContain('untrusted evidence');
    expect(messages[1].content).toContain(
      `Required H2 headings: ${contract.headings.join(' | ')}`,
    );
    expect(messages[1].content).toContain('Prior evidence summary');
    expect(messages[1].content).toContain(
      'SOURCE: src/main.ts:10-12\nbootstrap();',
    );
  });

  it('normalizes fences, title, section order, unknown headings, and missing sections', () => {
    const contract = GUIDE_TEMPLATE_CONTRACTS[GuideType.PROJECT_OVERVIEW];
    const markdown = normalizeGuideMarkdown(
      [
        '```markdown',
        '# Wrong title',
        '## Application and Request Flow',
        'Flow details.',
        '## Unsupported Heading',
        'Additional detail.',
        '## Purpose',
        'Purpose details.',
        '```',
      ].join('\n'),
      'Project Overview',
      contract,
    );

    expect(markdown).toBe(
      [
        '# Project Overview',
        '',
        '## Purpose',
        '',
        'Purpose details.',
        '',
        '## Architecture Overview',
        '',
        'Unclear from indexed evidence.',
        '',
        '## Application and Request Flow',
        '',
        'Flow details.',
        '### Unsupported Heading',
        'Additional detail.',
        '',
        '## Data Flow',
        '',
        'Unclear from indexed evidence.',
        '',
        '## Entry Points',
        '',
        'Unclear from indexed evidence.',
        '',
        '## Main Domains',
        '',
        'Unclear from indexed evidence.',
        '',
        '## External Integrations',
        '',
        'Unclear from indexed evidence.',
        '',
      ].join('\n'),
    );
  });

  it('creates stable slugs and plain bounded summaries', () => {
    expect(stableSlug('  Café / Billing_Service  ')).toBe(
      'cafe-billing-service',
    );
    expect(stableSlug('!!!')).toBe('guide');
    expect(
      deriveGuideSummary(
        '# Title\n\n## Purpose\n\nA **linked** [system](https://example.com) uses `BillingService`.',
      ),
    ).toBe('A linked system uses BillingService.');
    expect(deriveGuideSummary('one two three four five', 15)).toBe(
      'one two three…',
    );
  });

  it('keeps truncated slugs unique when long inputs share a prefix', () => {
    const sharedPrefix =
      'apps/api/src/modules/code-intelligence/extractors/code-intelligence-parse.service.ts#';
    const left = stableSlug(`${sharedPrefix}CodeIntelligenceParseService`);
    const right = stableSlug(`${sharedPrefix}CodeIntelligenceParseHelper`);

    expect(left).not.toBe(right);
    expect(left.length).toBeLessThanOrEqual(96);
    expect(right.length).toBeLessThanOrEqual(96);
    expect(left).toMatch(/-[0-9a-f]{8}$/);
    expect(right).toMatch(/-[0-9a-f]{8}$/);
    expect(stableSlug(`${sharedPrefix}CodeIntelligenceParseService`)).toBe(
      left,
    );
  });
});
