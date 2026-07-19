import { Injectable } from '@nestjs/common';
import { SymbolRelationType } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { RepositoryInventoryService } from '../inventory/repository-inventory.service';
import { TreeSitterLanguageParserService } from '../parser/tree-sitter-language-parser.service';
import { SymbolRelationshipExtractorService } from '../relationships/symbol-relationship-extractor.service';
import { RepositoryScannerService } from '../scanner/repository-scanner.service';
import { CodeIntelligenceStorageService } from '../storage/code-intelligence-storage.service';
import { SymbolExtractorService } from './symbol-extractor.service';

@Injectable()
export class CodeIntelligenceParseService {
  constructor(
    private readonly scannerService: RepositoryScannerService,
    private readonly inventoryService: RepositoryInventoryService,
    private readonly parserService: TreeSitterLanguageParserService,
    private readonly symbolExtractorService: SymbolExtractorService,
    private readonly relationshipExtractorService: SymbolRelationshipExtractorService,
    private readonly storageService: CodeIntelligenceStorageService,
  ) {}

  async parseRepository(params: {
    repositoryId: string;
    indexingRunId: string;
    clonePath: string;
  }): Promise<{
    supportedFileCount: number;
    ignoredFileCount: number;
    symbolCount: number;
  }> {
    let symbolCount = 0;

    const scanMetrics = await this.scannerService.scanRepository(
      params.clonePath,
      async (candidate) => {
        const source = await readFile(candidate.absolutePath, 'utf8');
        const ast = this.parserService.parse(candidate, source);

        const inventoryEntry = await this.inventoryService.upsertInventoryEntry(
          {
            repositoryId: params.repositoryId,
            indexingRunId: params.indexingRunId,
            candidate,
            source,
          },
        );

        const extractedSymbols = this.symbolExtractorService
          .extract(candidate.relativePath, ast)
          .map((symbol) => ({
            ...symbol,
            language: candidate.language,
            filePath: candidate.relativePath,
          }));

        const symbolIdMap = await this.storageService.createCodeSymbols(
          params.repositoryId,
          params.indexingRunId,
          inventoryEntry.id,
          candidate.relativePath,
          extractedSymbols,
        );
        symbolCount += extractedSymbols.length;

        const extractedRelationships =
          this.relationshipExtractorService.extract({
            filePath: candidate.relativePath,
            ast,
            symbols: extractedSymbols,
          });

        if (extractedRelationships.length > 0) {
          const relationRows: Array<{
            fromSymbolId: string;
            toSymbolId?: string;
            relationType: SymbolRelationType;
            targetQualifiedName?: string;
            targetFilePath?: string;
          }> = [];

          for (const relationship of extractedRelationships) {
            const fromSymbolId = symbolIdMap.get(
              relationship.fromSymbolLocalId,
            );
            if (!fromSymbolId) {
              continue;
            }
            relationRows.push({
              fromSymbolId,
              toSymbolId: relationship.toSymbolLocalId
                ? symbolIdMap.get(relationship.toSymbolLocalId)
                : undefined,
              relationType: relationship.relationType,
              targetQualifiedName: relationship.toSymbolQualifiedName,
              targetFilePath: relationship.targetFilePath,
            });
          }

          await this.storageService.createSymbolRelations({
            repositoryId: params.repositoryId,
            indexingRunId: params.indexingRunId,
            relations: relationRows,
          });
        }
      },
    );

    return {
      supportedFileCount: scanMetrics.supportedFileCount,
      ignoredFileCount: scanMetrics.ignoredFileCount,
      symbolCount,
    };
  }
}
