import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UpsertWorkspaceAiSettingsDto {
  @ApiProperty({ example: 'sk-...' })
  @IsString()
  @MinLength(8)
  openaiApiKey!: string;
}
