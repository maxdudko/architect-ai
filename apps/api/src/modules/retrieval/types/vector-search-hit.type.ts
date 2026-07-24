export interface VectorSearchHit {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}
