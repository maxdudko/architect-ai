export type SearchFilterOperator = 'eq' | 'any';

export interface SearchFilterCondition {
  field: string;
  operator: SearchFilterOperator;
  value: string | string[];
}

/**
 * Provider-agnostic filter tree. Adapters translate this into store-specific
 * filter payloads (e.g. Qdrant must/should clauses).
 */
export interface SearchFilter {
  must: SearchFilterCondition[];
}
