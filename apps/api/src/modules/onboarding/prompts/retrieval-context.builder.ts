import { Injectable } from '@nestjs/common';
import type { RetrievedContext } from '../../retrieval/types/retrieved-context.type';

const DEFAULT_MAX_CONTEXT_CHARACTERS = 24_000;
const MAX_CHUNK_CHARACTERS = 3_500;

@Injectable()
export class RetrievalContextBuilder {
  build(
    context: RetrievedContext,
    maxCharacters = DEFAULT_MAX_CONTEXT_CHARACTERS,
  ): string {
    const sections: string[] = [];
    let used = 0;

    for (const chunk of context.chunks) {
      const location =
        chunk.startLine === null
          ? chunk.filePath
          : `${chunk.filePath}:${chunk.startLine}-${chunk.endLine ?? chunk.startLine}`;
      const content = chunk.content.slice(0, MAX_CHUNK_CHARACTERS).trim();
      const section = `SOURCE: ${location}\n${content}`;
      if (used + section.length > maxCharacters) break;
      sections.push(section);
      used += section.length;
    }

    return sections.length
      ? sections.join('\n\n---\n\n')
      : 'No sufficiently relevant indexed chunks were retrieved.';
  }
}
