import { Module } from '@nestjs/common';
import { RepositoriesRepository } from '../../repositories/repositories.repository';
import { TreeSitterLanguageParserService } from './parser/tree-sitter-language-parser.service';
import { RepositoryScannerService } from './scanner/repository-scanner.service';
import { LanguageDetectorService } from './languages/language-detector.service';
import { ChecksumService } from './utils/checksum.service';
import { SymbolExtractorService } from './extractors/symbol-extractor.service';
import { SymbolRelationshipExtractorService } from './relationships/symbol-relationship-extractor.service';
import { CodeIntelligenceStorageService } from './storage/code-intelligence-storage.service';
import { RepositoryInventoryService } from './inventory/repository-inventory.service';
import { TextMetricsService } from './utils/text-metrics.service';
import { GeneratedFileDetectorService } from './utils/generated-file-detector.service';
import { CodeIntelligenceParseService } from './extractors/code-intelligence-parse.service';
import { ChunkBuilderService } from './extractors/chunk-builder.service';

@Module({
  providers: [
    RepositoriesRepository,
    RepositoryScannerService,
    LanguageDetectorService,
    ChecksumService,
    TreeSitterLanguageParserService,
    SymbolExtractorService,
    SymbolRelationshipExtractorService,
    CodeIntelligenceStorageService,
    RepositoryInventoryService,
    TextMetricsService,
    GeneratedFileDetectorService,
    CodeIntelligenceParseService,
    ChunkBuilderService,
  ],
  exports: [CodeIntelligenceParseService, ChunkBuilderService],
})
export class CodeIntelligenceModule {}
