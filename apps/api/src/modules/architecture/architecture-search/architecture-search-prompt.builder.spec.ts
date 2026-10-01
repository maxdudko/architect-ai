import { SymbolRelationType } from '@prisma/client';
import type { RetrievedContext } from '../../retrieval/types/retrieved-context.type';
import { ARCHITECTURE_SEARCH_CLASSIFIER_MARKER } from './architecture-search.constants';
import { ArchitectureSearchPromptBuilder } from './architecture-search-prompt.builder';
import type { StructuralFinding } from './structural-query';
import { parseClassifierResponse } from './parse-classifier';

const emptyRetrieval: RetrievedContext = {
  chunks: [],
  symbols: [],
  files: [],
  references: [],
};

const finding: StructuralFinding = {
  direction: 'DEPENDENT',
  moduleKey: 'src/billing',
  moduleName: 'Billing',
  relatedModuleKey: 'src/features',
  relatedModuleName: 'Features',
  relationTypes: [SymbolRelationType.IMPORTS],
  supportingRelationCount: 2,
  confidence: 'RESOLVED',
  epistemic: 'OBSERVED',
  evidence: [],
};

describe('ArchitectureSearchPromptBuilder', () => {
  const builder = new ArchitectureSearchPromptBuilder();

  it('asks the classifier for verbatim entities and marks the prompt', () => {
    const messages = builder.buildClassifier({
      question: 'What depends on Auth?',
      modules: [],
    });
    const text = messages.map((message) => message.content).join('\n');

    expect(text).toContain(ARCHITECTURE_SEARCH_CLASSIFIER_MARKER);
    expect(text).toContain('verbatim');
    expect(messages.at(-1)?.content).toBe('What depends on Auth?');
  });

  it('treats repository text as untrusted and forbids similarity as proof', () => {
    const prompt = builder.buildAnswer({
      question: 'What depends on Billing?',
      repositoryName: 'acme/platform',
      revisionLabel: 'abc123',
      intent: 'DEPENDENTS_OF',
      findings: [finding],
      limitations: ['Absence is not proof.'],
      retrieved: emptyRetrieval,
    });
    const text = prompt.messages.map((message) => message.content).join('\n');

    expect(text).toContain('untrusted');
    expect(text).toContain('never proof of a dependency');
    expect(text).toContain('Features');
    expect(prompt.contextTruncated).toBe(false);
  });

  it('states when retrieved source exceeds the character budget', () => {
    const prompt = builder.buildAnswer({
      question: 'How does billing work?',
      repositoryName: 'acme/platform',
      revisionLabel: 'abc123',
      intent: 'SOURCE_EXPLANATION',
      findings: [],
      limitations: [],
      retrieved: {
        ...emptyRetrieval,
        chunks: [
          {
            id: 'chunk-1',
            repositoryId: 'repo-1',
            fileId: null,
            symbolId: null,
            filePath: 'src/billing/invoice.ts',
            content: 'x'.repeat(9_000),
            tokenCount: 1,
            startLine: 1,
            endLine: 2,
            language: 'typescript',
            symbolName: null,
            qualifiedName: null,
            symbolType: null,
            score: 0.4,
          },
        ],
      },
    });
    const text = prompt.messages.map((message) => message.content).join('\n');

    expect(prompt.contextTruncated).toBe(true);
    expect(text).toContain('truncated');
    expect(text).not.toContain('x'.repeat(9_000));
  });
});

describe('parseClassifierResponse', () => {
  it('reads an intent object wrapped in prose', () => {
    expect(
      parseClassifierResponse(
        'Sure.\n{"intent":"DEPENDENTS_OF","entities":[" Billing "]}',
      ),
    ).toEqual({ intent: 'DEPENDENTS_OF', entities: ['Billing'] });
  });

  it('rejects an intent outside the closed set', () => {
    expect(() =>
      parseClassifierResponse('{"intent":"TRANSITIVE","entities":["Auth"]}'),
    ).toThrow('could not interpret');
  });
});
