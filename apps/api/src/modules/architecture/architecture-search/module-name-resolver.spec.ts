import type { ArchitectureModuleNode } from '../dependency-mapping/types/dependency-graph.type';
import { resolveModuleName } from './module-name-resolver';

function moduleNode(key: string, name: string): ArchitectureModuleNode {
  return {
    key,
    name,
    path: key,
    fileCount: 2,
    symbolCount: 1,
    languages: ['typescript'],
    outgoingDependencyCount: 0,
    incomingDependencyCount: 0,
    internalRelationCount: 0,
    unresolvedRelationCount: 0,
    externalRelationCount: 0,
    significance: 3,
  };
}

const modules = [
  moduleNode('src/billing', 'Billing'),
  moduleNode('src/shared', 'Shared'),
  moduleNode('lib/shared', 'Shared'),
];

describe('resolveModuleName', () => {
  it('matches a module name without regard to case', () => {
    const result = resolveModuleName(modules, ' billing ');

    expect(result).toEqual({
      outcome: 'RESOLVED',
      module: { key: 'src/billing', name: 'Billing', path: 'src/billing' },
    });
  });

  it('returns every exact match when the name is shared', () => {
    const result = resolveModuleName(modules, 'shared');

    expect(result.outcome).toBe('AMBIGUOUS');
    if (result.outcome === 'AMBIGUOUS') {
      expect(result.total).toBe(2);
      expect(result.candidates.map((candidate) => candidate.key)).toEqual([
        'src/shared',
        'lib/shared',
      ]);
    }
  });

  it('offers nearby names when nothing matches exactly', () => {
    const result = resolveModuleName(modules, 'bill');

    expect(result).toEqual({
      outcome: 'NOT_FOUND',
      nearCandidates: [
        { key: 'src/billing', name: 'Billing', path: 'src/billing' },
      ],
    });
  });

  it('resolves a unique file path to the module that contains it', () => {
    const result = resolveModuleName(modules, 'src/billing/invoice.ts', {
      'src/billing': ['src/billing/invoice.ts', 'src/billing/tax.ts'],
      'src/shared': ['src/shared/logger.ts'],
      'lib/shared': ['lib/shared/logger.ts'],
    });

    expect(result.outcome).toBe('RESOLVED');
    if (result.outcome === 'RESOLVED') {
      expect(result.module.key).toBe('src/billing');
    }
  });
});
