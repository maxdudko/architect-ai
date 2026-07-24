export interface VectorSearchOptions {
  topK: number;
  withPayload?: boolean | string[];
  scoreThreshold?: number;
}
