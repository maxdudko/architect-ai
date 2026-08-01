import { Inject, Injectable } from '@nestjs/common';
import { GuideType } from '@prisma/client';
import type { GuideGenerator } from '../interfaces/guide-generator.interface';
import { GUIDE_GENERATORS } from '../interfaces/tokens';

@Injectable()
export class GuideGeneratorRegistry {
  private readonly byType: ReadonlyMap<GuideType, GuideGenerator>;

  constructor(
    @Inject(GUIDE_GENERATORS)
    generators: readonly GuideGenerator[],
  ) {
    const byType = new Map<GuideType, GuideGenerator>();
    for (const generator of generators) {
      if (byType.has(generator.type)) {
        throw new Error(`Duplicate guide generator for ${generator.type}`);
      }
      byType.set(generator.type, generator);
    }
    this.byType = byType;
  }

  get(type: GuideType): GuideGenerator {
    const generator = this.byType.get(type);
    if (!generator)
      throw new Error(`No guide generator registered for ${type}`);
    return generator;
  }

  list(): GuideGenerator[] {
    return [...this.byType.values()];
  }
}
