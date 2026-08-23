import { LanguageDetectorService } from './language-detector.service';
import { createDefaultLanguagePackRegistry } from './default-language-packs';

describe('LanguageDetectorService', () => {
  const service = new LanguageDetectorService(
    createDefaultLanguagePackRegistry(),
  );

  it('detects TypeScript files', () => {
    expect(service.detect('/tmp/repo/src/app.ts')).toBe('typescript');
    expect(service.detect('/tmp/repo/src/app.tsx')).toBe('typescript');
  });

  it('detects JavaScript files', () => {
    expect(service.detect('/tmp/repo/src/app.js')).toBe('javascript');
    expect(service.detect('/tmp/repo/src/app.mjs')).toBe('javascript');
  });

  it('detects Python and PHP files', () => {
    expect(service.detect('/tmp/repo/app.py')).toBe('python');
    expect(service.detect('/tmp/repo/types.pyi')).toBe('python');
    expect(service.detect('/tmp/repo/index.php')).toBe('php');
    expect(service.detect('/tmp/repo/view.phtml')).toBe('php');
  });

  it('returns null for unsupported files', () => {
    expect(service.detect('/tmp/repo/README.md')).toBeNull();
  });
});
