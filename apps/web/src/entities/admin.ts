export interface Admin {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  lastLoginAt: string | null;
}

export interface AdminListedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  deletedAt: string | null;
}

export interface AdminUsersPage {
  items: AdminListedUser[];
  total: number;
  page: number;
  pageSize: number;
}

export type AdminSystemLogCategory = 'HTTP' | 'AUDIT';
export type AdminSystemLogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface AdminListedLog {
  id: string;
  category: AdminSystemLogCategory;
  level: AdminSystemLogLevel;
  event: string;
  message: string | null;
  requestId: string | null;
  actorType: string | null;
  actorId: string | null;
  workspaceId: string | null;
  repositoryId: string | null;
  method: string | null;
  route: string | null;
  statusCode: number | null;
  latencyMs: number | null;
  metadata: unknown;
  createdAt: string;
}

export interface AdminLogsPage {
  items: AdminListedLog[];
  total: number;
  page: number;
  pageSize: number;
}

export type AdminAnalyticsEventType =
  | 'REPOSITORY_CONNECTED'
  | 'REPOSITORY_INDEXING_SUCCEEDED'
  | 'REPOSITORY_INDEXING_FAILED';

export interface AdminAnalyticsOverview {
  repositoryConnections: number;
  indexingSucceeded: number;
  indexingFailed: number;
  questionsAsked: number;
  sourceCitations: number;
  feedback: {
    helpful: number;
    notHelpful: number;
    total: number;
    helpfulRate: number | null;
  };
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    answersWithUsage: number;
    answerCount: number;
    coverageRate: number | null;
  };
  activeUsage: {
    dau: number;
    wau: number;
    stickiness: number | null;
    timezone: 'UTC';
  };
}

export interface AdminRepositoryEvent {
  id: string;
  type: AdminAnalyticsEventType;
  workspaceId: string;
  workspaceName: string | null;
  workspaceSlug: string | null;
  actorUserId: string | null;
  actorEmail: string | null;
  repositoryId: string | null;
  repositoryFullName: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminQuestionRow {
  id: string;
  conversationId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  repositoryId: string | null;
  repositoryFullName: string | null;
  userId: string;
  userEmail: string;
  conversationTitle: string | null;
  content: string;
  createdAt: string;
}

export interface AdminSourceRow {
  workspaceId: string;
  workspaceName: string | null;
  workspaceSlug: string | null;
  repositoryId: string;
  repositoryFullName: string | null;
  filePath: string;
  citationCount: number;
  averageScore: number | null;
}

export interface AdminFeedbackRow {
  id: string;
  workspaceId: string;
  workspaceName: string | null;
  workspaceSlug: string | null;
  conversationId: string;
  messageId: string;
  userId: string;
  userEmail: string;
  userName: string;
  rating: 'HELPFUL' | 'NOT_HELPFUL';
  messageSnippet: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTokenUsageRow {
  workspaceId: string;
  workspaceName: string | null;
  workspaceSlug: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  answersWithUsage: number;
  answerCount: number;
}

export interface AdminActiveUsageDay {
  day: string;
  activeUsers: number;
  questions: number;
}

export interface AdminActiveUsagePage {
  items: AdminActiveUsageDay[];
  total: number;
  page: number;
  pageSize: number;
  days: number;
  timezone: 'UTC';
}

export interface AdminPaginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
