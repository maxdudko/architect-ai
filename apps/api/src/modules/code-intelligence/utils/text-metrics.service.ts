import { Injectable } from '@nestjs/common';

@Injectable()
export class TextMetricsService {
  lineCount(content: string): number {
    if (!content) {
      return 0;
    }
    return content.split('\n').length;
  }

  tokenCount(content: string): number {
    return content.split(/\s+/).filter(Boolean).length;
  }
}
