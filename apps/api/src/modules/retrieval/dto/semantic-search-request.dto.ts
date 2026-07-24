export class SemanticSearchRequestDto {
  query!: string;
  workspaceId!: string;
  repositoryIds?: string[];
  language?: string;
  symbolType?: string;
  branch?: string;
  topK?: number;
  scoreThreshold?: number;
}
