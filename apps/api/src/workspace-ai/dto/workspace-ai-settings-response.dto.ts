import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AiProvider } from '@prisma/client';

export class WorkspaceAiCredentialSummaryDto {
  @ApiProperty({ enum: AiProvider })
  provider!: AiProvider;

  @ApiProperty()
  keyLast4!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class WorkspaceAiSettingsResponseDto {
  @ApiProperty({ enum: ['HOSTED', 'BYOK'] })
  mode!: 'HOSTED' | 'BYOK';

  @ApiPropertyOptional({ enum: AiProvider, nullable: true })
  activeProvider!: AiProvider | null;

  @ApiProperty({ type: [WorkspaceAiCredentialSummaryDto] })
  credentials!: WorkspaceAiCredentialSummaryDto[];
}
