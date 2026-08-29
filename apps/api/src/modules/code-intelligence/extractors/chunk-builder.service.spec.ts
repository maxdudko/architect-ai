import { readFile } from 'node:fs/promises';
import { CodeIntelligenceStorageService } from '../storage/code-intelligence-storage.service';
import { TextMetricsService } from '../utils/text-metrics.service';
import { ChunkBuilderService } from './chunk-builder.service';

jest.mock('node:fs/promises', () => ({
  readFile: jest.fn(),
}));

describe('ChunkBuilderService', () => {
  let storageService: jest.Mocked<CodeIntelligenceStorageService>;
  let service: ChunkBuilderService;

  beforeEach(() => {
    storageService = {
      listRepositoryFiles: jest.fn().mockResolvedValue([
        {
          id: 'file-1',
          path: 'src/auth.service.ts',
          generated: false,
        },
      ]),
      listCodeSymbols: jest.fn().mockResolvedValue([
        {
          id: 'symbol-1',
          fileId: 'file-1',
          type: 'METHOD',
          startLine: 2,
          endLine: 2,
          language: 'typescript',
          qualifiedName: 'AuthService.login',
        },
      ]),
      createChunk: jest.fn().mockResolvedValue({}),
      deleteChunksForIndexingRun: jest.fn().mockResolvedValue({ count: 0 }),
    } as unknown as jest.Mocked<CodeIntelligenceStorageService>;

    service = new ChunkBuilderService(storageService, new TextMetricsService());
    (readFile as jest.MockedFunction<typeof readFile>).mockResolvedValue(
      ['export class AuthService {', '  login() { return true; }', '}'].join(
        '\n',
      ),
    );
  });

  it('creates semantic chunks per symbol', async () => {
    const result = await service.buildChunks({
      repositoryId: 'repo-1',
      indexingRunId: 'run-1',
      clonePath: '/tmp/repo',
    });

    expect(storageService.createChunk).toHaveBeenCalledTimes(1);
    expect(result.chunkCount).toBe(1);
    expect(result.tokenCount).toBeGreaterThan(0);
  });

  it('skips generated files when building chunks', async () => {
    storageService.listRepositoryFiles.mockResolvedValue([
      {
        id: 'file-1',
        path: 'src/auth.generated.ts',
        generated: true,
      },
    ] as never);

    const result = await service.buildChunks({
      repositoryId: 'repo-1',
      indexingRunId: 'run-1',
      clonePath: '/tmp/repo',
    });

    expect(storageService.createChunk).not.toHaveBeenCalled();
    expect(result).toEqual({ chunkCount: 0, tokenCount: 0 });
  });
});
