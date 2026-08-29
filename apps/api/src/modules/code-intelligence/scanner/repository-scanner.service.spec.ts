import { LanguageDetectorService } from '../languages/language-detector.service';
import { createDefaultLanguagePackRegistry } from '../languages/default-language-packs';
import { ChecksumService } from '../utils/checksum.service';
import { UnparseableFileError } from '../errors/unparseable-file.error';
import { RepositoryScannerService } from './repository-scanner.service';

jest.mock('node:fs/promises', () => ({
  readdir: jest.fn(),
  stat: jest.fn(),
}));

import { readdir, stat } from 'node:fs/promises';

describe('RepositoryScannerService', () => {
  let checksumService: jest.Mocked<ChecksumService>;
  let languageDetectorService: jest.Mocked<LanguageDetectorService>;
  let service: RepositoryScannerService;

  beforeEach(() => {
    checksumService = {
      hashFile: jest.fn().mockResolvedValue('abc123'),
    };
    languageDetectorService = {
      detect: jest.fn((filePath: string) =>
        filePath.endsWith('.ts') ? 'typescript' : null,
      ),
    } as unknown as jest.Mocked<LanguageDetectorService>;

    service = new RepositoryScannerService(
      checksumService,
      languageDetectorService,
      createDefaultLanguagePackRegistry(),
    );
  });

  it('scans source files and ignores binary files', async () => {
    (readdir as jest.MockedFunction<typeof readdir>)
      .mockResolvedValueOnce([
        { name: 'src', isDirectory: () => true, isFile: () => false },
        { name: 'logo.png', isDirectory: () => false, isFile: () => true },
      ] as never)
      .mockResolvedValueOnce([
        { name: 'main.ts', isDirectory: () => false, isFile: () => true },
      ] as never);

    (stat as jest.MockedFunction<typeof stat>).mockResolvedValue({
      size: 150,
    } as never);

    const candidates: string[] = [];
    const result = await service.scanRepository('/repo', (candidate) => {
      candidates.push(candidate.relativePath);
      return Promise.resolve();
    });

    expect(candidates).toEqual(['src/main.ts']);
    expect(result).toEqual({
      supportedFileCount: 1,
      ignoredFileCount: 1,
    });
  });

  it('skips files that fail parsing without aborting the scan', async () => {
    (readdir as jest.MockedFunction<typeof readdir>).mockResolvedValueOnce([
      { name: 'broken.ts', isDirectory: () => false, isFile: () => true },
      { name: 'ok.ts', isDirectory: () => false, isFile: () => true },
    ] as never);
    (stat as jest.MockedFunction<typeof stat>).mockResolvedValue({
      size: 150,
    } as never);

    const candidates: string[] = [];
    const result = await service.scanRepository('/repo', (candidate) => {
      if (candidate.relativePath === 'broken.ts') {
        return Promise.reject(
          new UnparseableFileError(candidate.relativePath, 'Invalid argument'),
        );
      }
      candidates.push(candidate.relativePath);
      return Promise.resolve();
    });

    expect(candidates).toEqual(['ok.ts']);
    expect(result).toEqual({
      supportedFileCount: 1,
      ignoredFileCount: 1,
    });
  });

  it('inventories manifests and skips ignored Python/PHP folders', async () => {
    (readdir as jest.MockedFunction<typeof readdir>).mockResolvedValueOnce([
      { name: 'venv', isDirectory: () => true, isFile: () => false },
      { name: 'vendor', isDirectory: () => true, isFile: () => false },
      { name: 'composer.json', isDirectory: () => false, isFile: () => true },
      { name: 'pyproject.toml', isDirectory: () => false, isFile: () => true },
    ] as never);

    (stat as jest.MockedFunction<typeof stat>).mockResolvedValue({
      size: 120,
    } as never);

    const candidates: Array<{ path: string; language: string }> = [];
    const result = await service.scanRepository('/repo', (candidate) => {
      candidates.push({
        path: candidate.relativePath,
        language: candidate.language,
      });
      return Promise.resolve();
    });

    expect(candidates).toEqual(
      expect.arrayContaining([
        { path: 'composer.json', language: 'config' },
        { path: 'pyproject.toml', language: 'config' },
      ]),
    );
    expect(result.supportedFileCount).toBe(2);
    expect(result.ignoredFileCount).toBe(2);
  });

  it('skips oversized indexable files without hashing them', async () => {
    (readdir as jest.MockedFunction<typeof readdir>).mockResolvedValueOnce([
      { name: 'huge.ts', isDirectory: () => false, isFile: () => true },
      { name: 'ok.ts', isDirectory: () => false, isFile: () => true },
    ] as never);
    (stat as jest.MockedFunction<typeof stat>)
      .mockResolvedValueOnce({ size: 2_000_000 } as never)
      .mockResolvedValueOnce({ size: 150 } as never);

    const candidates: string[] = [];
    const result = await service.scanRepository(
      '/repo',
      (candidate) => {
        candidates.push(candidate.relativePath);
        return Promise.resolve();
      },
      { maxFileSizeBytes: 1_048_576 },
    );

    expect(candidates).toEqual(['ok.ts']);
    expect(checksumService.hashFile).toHaveBeenCalledTimes(1);
    expect(result.supportedFileCount).toBe(1);
    expect(result.ignoredFileCount).toBe(1);
  });

  it('aborts discovery when indexable files exceed the plan cap before hashing', async () => {
    (readdir as jest.MockedFunction<typeof readdir>).mockResolvedValueOnce([
      { name: 'a.ts', isDirectory: () => false, isFile: () => true },
      { name: 'b.ts', isDirectory: () => false, isFile: () => true },
    ] as never);
    (stat as jest.MockedFunction<typeof stat>).mockResolvedValue({
      size: 150,
    } as never);

    await expect(
      service.scanRepository('/repo', () => Promise.resolve(), {
        maxIndexableFiles: 1,
      }),
    ).rejects.toMatchObject({
      name: 'IndexableFilesLimitExceededError',
      used: 2,
      limit: 1,
    });
    expect(checksumService.hashFile).not.toHaveBeenCalled();
  });
});
