export interface GithubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
}

export interface GithubViewerResponse {
  id: number;
  login: string;
}

export interface GithubRepositoryResponse {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  owner: {
    login: string;
  };
}

export interface GithubInstallationResponse {
  id: number;
  app_slug?: string;
}

export interface GithubInstallationsListResponse {
  total_count?: number;
  installations?: GithubInstallationResponse[];
}

export interface GithubInstallationRepositoriesResponse {
  total_count?: number;
  repositories?: GithubRepositoryResponse[];
}

export interface GithubBranchResponse {
  name: string;
  protected: boolean;
}

export interface GithubGitTreeEntry {
  path?: string;
  type?: string;
  size?: number;
}

export interface GithubGitTreeResponse {
  sha: string;
  truncated: boolean;
  tree: GithubGitTreeEntry[];
}

export interface GithubBranchDetailResponse {
  name: string;
  commit: {
    sha: string;
    commit?: {
      tree?: {
        sha: string;
      };
    };
  };
}
