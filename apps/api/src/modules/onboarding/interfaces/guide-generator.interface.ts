import { GuideType } from '@prisma/client';
import type {
  GuideGenerationContext,
  GuideGenerationResult,
  GuideGenerationTarget,
} from '../types/guide-generation.type';

export interface GuideGenerator {
  readonly type: GuideType;
  targets(context: GuideGenerationContext): GuideGenerationTarget[];
  generate(
    context: GuideGenerationContext,
    target: GuideGenerationTarget,
  ): Promise<GuideGenerationResult>;
}
