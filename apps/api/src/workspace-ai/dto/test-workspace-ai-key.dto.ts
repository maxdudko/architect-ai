import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class TestWorkspaceAiKeyDto {
  @ApiPropertyOptional({ example: 'sk-...' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  openaiApiKey?: string;
}

export class TestWorkspaceAiKeyResponseDto {
  @ApiProperty()
  ok!: boolean;

  @ApiProperty()
  message!: string;
}
