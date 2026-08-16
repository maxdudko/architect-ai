import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WorkspaceAiSettingsResponseDto {
  @ApiProperty({ enum: ['HOSTED', 'BYOK'] })
  mode!: 'HOSTED' | 'BYOK';

  @ApiPropertyOptional({ nullable: true })
  openaiKeyLast4!: string | null;

  @ApiPropertyOptional({ nullable: true })
  updatedAt!: string | null;
}
