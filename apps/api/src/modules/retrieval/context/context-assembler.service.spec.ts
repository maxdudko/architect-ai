import { ChunkDataSource } from '../interfaces/chunk-data-source.interface';
import { ScoredChunkCandidate } from '../types/scored-chunk-candidate.type';
import { ContextAssemblerService } from './context-assembler.service';

describe('ContextAssemblerService', () => {
  it('assembles structured context and deduplicates identical spans', async () => {
    const chunkDataSource: ChunkDataSource = {
      listChunksForIndexing: jest.fn(),
      getChunksByIds: jest.fn().mockResolvedValue([
        {
          id: 'chunk-1',
          repositoryId: 'repo-1',
          fileId: 'file-1',
          symbolId: 'symbol-1',
          filePath: 'src/auth.ts',
          content: 'class Auth {}',
          tokenCount: 3,
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          symbolName: 'Auth',
          qualifiedName: 'Auth',
          symbolType: 'CLASS',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'chunk-2',
          repositoryId: 'repo-1',
          fileId: 'file-1',
          symbolId: 'symbol-1',
          filePath: 'src/auth.ts',
          content: 'class Auth {}',
          tokenCount: 3,
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          symbolName: 'Auth',
          qualifiedName: 'Auth',
          symbolType: 'CLASS',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]),
    };

    const service = new ContextAssemblerService(chunkDataSource);
    const candidates: ScoredChunkCandidate[] = [
      {
        chunkId: 'chunk-1',
        score: 0.9,
        workspaceId: 'ws-1',
        repositoryId: 'repo-1',
        fileId: 'file-1',
        symbolId: 'symbol-1',
        filePath: 'src/auth.ts',
        symbolName: 'Auth',
        qualifiedName: 'Auth',
        symbolType: 'CLASS',
        language: 'typescript',
        branch: 'main',
        createdAt: null,
      },
      {
        chunkId: 'chunk-2',
        score: 0.8,
        workspaceId: 'ws-1',
        repositoryId: 'repo-1',
        fileId: 'file-1',
        symbolId: 'symbol-1',
        filePath: 'src/auth.ts',
        symbolName: 'Auth',
        qualifiedName: 'Auth',
        symbolType: 'CLASS',
        language: 'typescript',
        branch: 'main',
        createdAt: null,
      },
    ];

    const context = await service.assemble(candidates);

    expect(context.chunks).toHaveLength(1);
    expect(context.symbols).toHaveLength(1);
    expect(context.files).toHaveLength(1);
    expect(context.references).toHaveLength(1);
    expect(context.chunks[0]?.score).toBe(0.9);
  });
});
