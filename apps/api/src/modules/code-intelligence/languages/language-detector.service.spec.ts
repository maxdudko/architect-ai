import { LanguageDetectorService } from './language-detector.service';

describe('LanguageDetectorService', () => {
  const service = new LanguageDetectorService();

  it('detects TypeScript files', () => {
    expect(service.detect('/tmp/repo/src/app.ts')).toBe('typescript');
    expect(service.detect('/tmp/repo/src/app.tsx')).toBe('typescript');
  });

  it('detects JavaScript files', () => {
    expect(service.detect('/tmp/repo/src/app.js')).toBe('javascript');
    expect(service.detect('/tmp/repo/src/app.mjs')).toBe('javascript');
  });

  it('returns null for unsupported files', () => {
    expect(service.detect('/tmp/repo/README.md')).toBeNull();
  });
});
