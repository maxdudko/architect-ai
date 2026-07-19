import { SymbolRelationType } from '@prisma/client';
import { SymbolRelationshipExtractorService } from './symbol-relationship-extractor.service';

describe('SymbolRelationshipExtractorService', () => {
  const service = new SymbolRelationshipExtractorService();

  it('extracts import and call relationships', () => {
    const relationships = service.extract({
      filePath: 'src/auth.service.ts',
      ast: {
        language: 'typescript',
        source:
          "import { JwtService } from '@nestjs/jwt';\nlogin() { this.validate(); }",
        tree: {
          root: {
            type: 'program',
            text: '',
            range: {
              start: { line: 1, column: 1 },
              end: { line: 2, column: 30 },
            },
            children: [
              {
                type: 'import_statement',
                text: "import { JwtService } from '@nestjs/jwt';",
                range: {
                  start: { line: 1, column: 1 },
                  end: { line: 1, column: 40 },
                },
                children: [],
              },
              {
                type: 'call_expression',
                text: 'this.validate()',
                range: {
                  start: { line: 2, column: 11 },
                  end: { line: 2, column: 26 },
                },
                children: [],
              },
            ],
          },
        },
      },
      symbols: [
        {
          localId: 'module:src/auth.service.ts',
          name: 'auth.service.ts',
          qualifiedName: 'src/auth.service.ts',
          type: 'MODULE',
          language: 'typescript',
          filePath: 'src/auth.service.ts',
          startLine: 1,
          endLine: 40,
          startColumn: 1,
          endColumn: 1,
          exported: true,
          isAsync: false,
          isStatic: false,
          visibility: 'module',
          parentLocalId: null,
        },
      ],
    });

    expect(
      relationships.some(
        (item) => item.relationType === SymbolRelationType.IMPORTS,
      ),
    ).toBe(true);
    expect(
      relationships.some(
        (item) => item.relationType === SymbolRelationType.CALLS,
      ),
    ).toBe(true);
  });
});
