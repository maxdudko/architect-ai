import { LanguageDetectorService } from '../languages/language-detector.service';
import { ChecksumService } from '../utils/checksum.service';
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
});
