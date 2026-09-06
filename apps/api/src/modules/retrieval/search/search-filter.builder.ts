import {
  SearchFilter,
  SearchFilterCondition,
} from '../types/search-filter.type';

/**
 * Builds provider-agnostic search filters. Vector store adapters are
 * responsible for translating the result into store-specific payloads.
 */
export class SearchFilterBuilder {
  private readonly conditions: SearchFilterCondition[] = [];

  workspace(workspaceId: string): this {
    this.conditions.push({
      field: 'workspaceId',
      operator: 'eq',
      value: workspaceId,
    });
    return this;
  }

  repository(repositoryId: string | string[]): this {
    const value = Array.isArray(repositoryId) ? repositoryId : [repositoryId];
    const [singleRepositoryId] = value;
    if (value.length === 1 && singleRepositoryId) {
      this.conditions.push({
        field: 'repositoryId',
        operator: 'eq',
        value: singleRepositoryId,
      });
      return this;
    }

    this.conditions.push({
      field: 'repositoryId',
      operator: 'any',
      value,
    });
    return this;
  }

  language(language: string): this {
    this.conditions.push({
      field: 'language',
      operator: 'eq',
      value: language,
    });
    return this;
  }

  symbolType(symbolType: string): this {
    this.conditions.push({
      field: 'symbolType',
      operator: 'eq',
      value: symbolType,
    });
    return this;
  }

  branch(branch: string): this {
    this.conditions.push({
      field: 'branch',
      operator: 'eq',
      value: branch,
    });
    return this;
  }

  indexingRun(indexingRunId: string | string[]): this {
    const value = Array.isArray(indexingRunId)
      ? indexingRunId
      : [indexingRunId];
    const [singleIndexingRunId] = value;
    if (value.length === 1 && singleIndexingRunId) {
      this.conditions.push({
        field: 'indexingRunId',
        operator: 'eq',
        value: singleIndexingRunId,
      });
      return this;
    }

    this.conditions.push({
      field: 'indexingRunId',
      operator: 'any',
      value,
    });
    return this;
  }

  build(): SearchFilter {
    return {
      must: [...this.conditions],
    };
  }
}
