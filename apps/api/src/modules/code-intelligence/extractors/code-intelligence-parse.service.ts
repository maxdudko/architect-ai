import { Injectable } from '@nestjs/common';
import { SymbolRelationType } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import {
  isUnparseableFileError,
  UnparseableFileError,
} from '../errors/unparseable-file.error';
import { RepositoryInventoryService } from '../inventory/repository-inventory.service';
import { LanguagePackRegistry } from '../languages/language-pack.registry';
import { TreeSitterLanguageParserService } from '../parser/tree-sitter-language-parser.service';
import { SymbolRelationshipExtractorService } from '../relationships/symbol-relationship-extractor.service';
import { RepositoryScannerService } from '../scanner/repository-scanner.service';
import { CodeIntelligenceStorageService } from '../storage/code-intelligence-storage.service';
import { PROGRAMMING_LANGUAGES } from '../types/programming-language.type';
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
    private readonly languagePacks: LanguagePackRegistry,
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
        try {
          const source = await readFile(candidate.absolutePath, 'utf8');
          const inventoryEntry =
            await this.inventoryService.upsertInventoryEntry({
              repositoryId: params.repositoryId,
              indexingRunId: params.indexingRunId,
              candidate,
              source,
            });

          if (
            candidate.language === PROGRAMMING_LANGUAGES.config ||
            this.languagePacks.isManifest(candidate.relativePath) ||
            !this.parserService.supports(candidate.language)
          ) {
            return;
          }

          const ast = this.parserService.parse(candidate, source);

          const extractedSymbols = this.symbolExtractorService.extract(
            candidate.relativePath,
            ast,
          );

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
        } catch (error) {
          if (isUnparseableFileError(error)) {
            throw error;
          }
          // Native tree-sitter / fs edge cases (e.g. "Invalid argument") should
          // skip the file instead of failing the whole indexing run.
          throw new UnparseableFileError(candidate.relativePath, error);
        }
      },
    );

    await this.storageService.pruneStaleRepositoryFiles(
      params.repositoryId,
      params.indexingRunId,
    );

    return {
      supportedFileCount: scanMetrics.supportedFileCount,
      ignoredFileCount: scanMetrics.ignoredFileCount,
      symbolCount,
    };
  }
}
