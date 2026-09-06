import { createDefaultLanguagePackRegistry } from '../languages/default-language-packs';
import { classifyIndexableFile } from './indexable-file.policy';

describe('classifyIndexableFile', () => {
  const languagePacks = createDefaultLanguagePackRegistry();
  const ignoredFolders = languagePacks.ignoredFolders();

  function classify(
    relativePath: string,
    size: number,
    maxFileSizeBytes: number | null = 1_048_576,
  ) {
    return classifyIndexableFile({
      relativePath,
      size,
      ignoredFolders,
      isManifest: (path) => languagePacks.isManifest(path),
      detectLanguage: (path) => languagePacks.detectLanguage(path),
      maxFileSizeBytes,
    });
  }

  it('counts TypeScript sources as indexable', () => {
    expect(classify('src/main.ts', 120)).toBe('indexable');
  });

  it('counts manifests as indexable', () => {
    expect(classify('package.json', 80)).toBe('indexable');
  });

  it('ignores files under ignored folders', () => {
    expect(classify('node_modules/left-pad/index.js', 40)).toBe('ignored');
    expect(classify('dist/app.js', 40)).toBe('ignored');
  });

  it('ignores binary extensions', () => {
    expect(classify('logo.png', 4000)).toBe('ignored');
  });

  it('ignores unknown extensions', () => {
    expect(classify('notes.md', 200)).toBe('ignored');
  });

  it('ignores empty files', () => {
    expect(classify('src/empty.ts', 0)).toBe('ignored');
  });

  it('marks oversized indexable files separately', () => {
    expect(classify('src/bundle.ts', 2_000_000, 1_048_576)).toBe('oversized');
  });
});
