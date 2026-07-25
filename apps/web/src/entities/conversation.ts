export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

export interface ChatSourceReference {
  chunkId: string;
  repositoryId: string;
  filePath: string;
  symbolName?: string | null;
  qualifiedName?: string | null;
  startLine?: number | null;
  endLine?: number | null;
  score: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  metadata?: {
    sources?: ChatSourceReference[];
    model?: string;
    truncated?: boolean;
    provider?: string;
  } | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  workspaceId: string;
  repositoryId?: string | null;
  createdById: string;
  title?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDetail extends Conversation {
  messages: ChatMessage[];
}

export interface ChatAnswerResponse {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  sources: ChatSourceReference[];
}
