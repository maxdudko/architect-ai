import { PrismaService } from '../prisma/prisma.service';
import { RepositoriesRepository } from './repositories.repository';

describe('RepositoriesRepository blue-green inventory', () => {
  it('prunes only unseen files for the current indexing run', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const repository = new RepositoriesRepository({
      repositoryFile: { deleteMany },
    } as unknown as PrismaService);

    await repository.pruneStaleRepositoryFiles('repo-1', 'run-2', [
      'src/a.ts',
      'src/b.ts',
    ]);

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        repositoryId: 'repo-1',
        indexingRunId: 'run-2',
        path: { notIn: ['src/a.ts', 'src/b.ts'] },
      },
    });
  });

  it('deletes the current run inventory when the scan saw no files', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 2 });
    const repository = new RepositoriesRepository({
      repositoryFile: { deleteMany },
    } as unknown as PrismaService);

    await repository.pruneStaleRepositoryFiles('repo-1', 'run-2', []);

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        repositoryId: 'repo-1',
        indexingRunId: 'run-2',
      },
    });
  });

  it('lists current files from the latest succeeded indexing run', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'run-live' });
    const findMany = jest.fn().mockResolvedValue([]);
    const repository = new RepositoriesRepository({
      indexingRun: { findFirst },
      repositoryFile: { findMany },
    } as unknown as PrismaService);

    await repository.listCurrentRepositoryFiles('repo-1', {
      pathPrefix: 'src/',
    });

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          repositoryId: 'repo-1',
          status: 'SUCCEEDED',
        }),
      }),
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          repositoryId: 'repo-1',
          indexingRunId: 'run-live',
          path: { startsWith: 'src/' },
        },
      }),
    );
  });

  it('returns no current files when the repository has never succeeded', async () => {
    const findMany = jest.fn();
    const repository = new RepositoriesRepository({
      indexingRun: { findFirst: jest.fn().mockResolvedValue(null) },
      repositoryFile: { findMany },
    } as unknown as PrismaService);

    await expect(
      repository.listCurrentRepositoryFiles('repo-1'),
    ).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
