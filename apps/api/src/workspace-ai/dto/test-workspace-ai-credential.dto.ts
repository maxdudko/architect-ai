import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AiProvider } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class TestWorkspaceAiCredentialDto {
  @ApiProperty({ enum: AiProvider })
  @IsEnum(AiProvider)
  provider!: AiProvider;

  @ApiPropertyOptional({ example: 'sk-...' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  apiKey?: string;
}

export class TestWorkspaceAiKeyResponseDto {
  @ApiProperty()
  ok!: boolean;

  @ApiProperty()
  message!: string;
}
