import type { Message, Repository } from '@prisma/client';
import type { LlmMessage } from '../modules/llm/interfaces/llm-provider.interface';
import type { RetrievedContext } from '../modules/retrieval/types/retrieved-context.type';

export interface PromptContextInput {
  question: string;
  repository: Repository | null;
  retrievedContext: RetrievedContext;
  history: Message[];
  maxChunkChars?: number;
  maxHistoryMessages?: number;
}

const SYSTEM_PROMPT = `You are a senior engineer helping a new team member understand this codebase.

Answer clearly and concisely.
Reference source files by path when explaining behavior.
Avoid assumptions.
If information is missing from the provided context, say so.`;

export class PromptContextBuilder {
  build(input: PromptContextInput): LlmMessage[] {
    const maxChunkChars = input.maxChunkChars ?? 12_000;
    const maxHistoryMessages = input.maxHistoryMessages ?? 8;

    const messages: LlmMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'system',
        content: this.buildRepositorySection(input.repository),
      },
      {
        role: 'system',
        content: this.buildRetrievedSourcesSection(
          input.retrievedContext,
          maxChunkChars,
        ),
      },
    ];

    const history = input.history
      .slice()
      .reverse()
      .slice(-maxHistoryMessages)
      .filter(
        (message) => message.role === 'USER' || message.role === 'ASSISTANT',
      );

    for (const message of history) {
      messages.push({
        role: message.role === 'USER' ? 'user' : 'assistant',
        content: message.content,
      });
    }

    messages.push({ role: 'user', content: input.question });
    return messages;
  }

  private buildRepositorySection(repository: Repository | null): string {
    if (!repository) {
      return [
        'Repository information:',
        '- Scope: workspace-wide (no single repository selected)',
      ].join('\n');
    }

    return [
      'Repository information:',
      `- Full name: ${repository.fullName}`,
      `- Default branch: ${repository.defaultBranch}`,
      `- Status: ${repository.status}`,
    ].join('\n');
  }

  private buildRetrievedSourcesSection(
    context: RetrievedContext,
    maxChunkChars: number,
  ): string {
    if (context.chunks.length === 0) {
      return [
        'Retrieved sources:',
        'No relevant code chunks were retrieved for this question.',
      ].join('\n');
    }

    const parts: string[] = ['Retrieved sources:'];
    let usedChars = 0;

    for (const [index, chunk] of context.chunks.entries()) {
      const lineRange =
        chunk.startLine != null && chunk.endLine != null
          ? `:${chunk.startLine}-${chunk.endLine}`
          : '';
      const header = `[${index + 1}] ${chunk.filePath}${lineRange}${
        chunk.symbolName ? ` (${chunk.symbolName})` : ''
      }`;
      const body = chunk.content.trim();
      const block = `${header}\n${body}`;

      if (usedChars + block.length > maxChunkChars && parts.length > 1) {
        parts.push(
          `... truncated ${context.chunks.length - index} additional chunks`,
        );
        break;
      }

      parts.push(block);
      usedChars += block.length;
    }

    if (context.references.length > 0) {
      parts.push('Cite these source paths when relevant:');
      for (const reference of context.references.slice(0, 12)) {
        const lineRange =
          reference.startLine != null && reference.endLine != null
            ? `:${reference.startLine}-${reference.endLine}`
            : '';
        parts.push(`- ${reference.filePath}${lineRange}`);
      }
    }

    return parts.join('\n\n');
  }
}
