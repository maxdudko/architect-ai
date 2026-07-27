export interface GithubConnection {
  connected: boolean;
  login?: string;
  providerUserId?: string;
}

export interface GithubRepositorySummary {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  connectable: boolean;
}

export interface GithubRepositoriesResponse {
  repositories: GithubRepositorySummary[];
  nextCursor: string | null;
}

export interface GithubBranchSummary {
  name: string;
  isProtected: boolean;
}

export interface GithubBranchesResponse {
  branches: GithubBranchSummary[];
  defaultBranch: string;
  nextCursor: string | null;
}
