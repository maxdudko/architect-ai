import { Injectable } from '@nestjs/common';
import { RepositoryFile } from '@prisma/client';
import { RepositoryFileCandidate } from '../types/repository-file-candidate.type';
import { GeneratedFileDetectorService } from '../utils/generated-file-detector.service';
import { TextMetricsService } from '../utils/text-metrics.service';
import { CodeIntelligenceStorageService } from '../storage/code-intelligence-storage.service';

@Injectable()
export class RepositoryInventoryService {
  constructor(
    private readonly storageService: CodeIntelligenceStorageService,
    private readonly textMetricsService: TextMetricsService,
    private readonly generatedFileDetectorService: GeneratedFileDetectorService,
  ) {}

  async upsertInventoryEntry(params: {
    repositoryId: string;
    indexingRunId: string;
    candidate: RepositoryFileCandidate;
    source: string;
  }): Promise<RepositoryFile> {
    const generated = this.generatedFileDetectorService.isGenerated(
      params.candidate.relativePath,
      params.source,
    );

    return this.storageService.upsertRepositoryFile({
      repositoryId: params.repositoryId,
      indexingRunId: params.indexingRunId,
      path: params.candidate.relativePath,
      language: params.candidate.language,
      contentHash: params.candidate.checksum,
      size: params.candidate.size,
      lineCount: this.textMetricsService.lineCount(params.source),
      extension: params.candidate.extension,
      generated,
      ignored: false,
      binary: false,
    });
  }
}
