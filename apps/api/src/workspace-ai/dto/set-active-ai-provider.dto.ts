import { ApiPropertyOptional } from '@nestjs/swagger';
import { AiProvider } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class SetActiveAiProviderDto {
  @ApiPropertyOptional({
    enum: AiProvider,
    nullable: true,
    description:
      'Provider to activate. The provider must already have a saved credential. Omit or send null to switch to Hosted AI.',
  })
  @IsOptional()
  @IsEnum(AiProvider)
  provider?: AiProvider | null;
}
