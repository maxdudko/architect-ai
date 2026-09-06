import { ApiProperty } from '@nestjs/swagger';
import { AiProvider } from '@prisma/client';
import { IsEnum, IsString, MinLength } from 'class-validator';

export class UpsertWorkspaceAiCredentialDto {
  @ApiProperty({ enum: AiProvider })
  @IsEnum(AiProvider)
  provider!: AiProvider;

  @ApiProperty({ example: 'sk-...' })
  @IsString()
  @MinLength(8)
  apiKey!: string;
}
