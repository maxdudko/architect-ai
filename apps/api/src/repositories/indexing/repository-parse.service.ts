import { Injectable } from '@nestjs/common';
import { CodeIntelligenceParseService } from '../../modules/code-intelligence/extractors/code-intelligence-parse.service';

@Injectable()
export class RepositoryParseService {
  constructor(
    private readonly codeIntelligenceParseService: CodeIntelligenceParseService,
  ) {}

  async parseRepository(data: {
    workspaceId: string;
    repositoryId: string;
    runId: string;
    clonePath: string;
  }): Promise<{
    supportedFileCount: number;
    ignoredFileCount: number;
    symbolCount: number;
  }> {
    return this.codeIntelligenceParseService.parseRepository({
      repositoryId: data.repositoryId,
      indexingRunId: data.runId,
      clonePath: data.clonePath,
    });
  }
}
