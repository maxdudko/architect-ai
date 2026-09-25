import {
  coveredCitedPaths,
  extractCitedPaths,
  missingCitedPaths,
} from './cited-paths';

describe('cited paths', () => {
  it('reads repository paths from backticks and ignores line ranges', () => {
    const paths = extractCitedPaths(
      'See `src/billing/invoice.ts:10-20` and `package.json`. Ignore `https://example.com` and `/etc/passwd`.',
    );

    expect(paths).toEqual(['package.json', 'src/billing/invoice.ts']);
  });

  it('ignores package names and dotted product names', () => {
    expect(
      extractCitedPaths(
        'Uses `@nestjs/common` and `Next.js`. Module `apps/api` owns `apps/api/package.json`.',
      ),
    ).toEqual(['apps/api', 'apps/api/package.json']);
  });

  it('accepts a module directory when it contains an indexed file', () => {
    expect(
      coveredCitedPaths(
        ['apps/api', 'apps/ap', 'missing/file.ts'],
        ['apps/api/package.json'],
      ),
    ).toEqual(['apps/api']);
  });

  it('reports paths that are not in the revision', () => {
    expect(
      missingCitedPaths(
        ['src/billing/invoice.ts', 'missing/file.ts'],
        ['src/billing/invoice.ts'],
      ),
    ).toEqual(['missing/file.ts']);
  });
});
