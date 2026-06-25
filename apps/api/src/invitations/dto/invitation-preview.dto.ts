import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';

export class InvitationPreviewDto {
  @ApiProperty({ example: 'invitee@company.com' })
  email!: string;

  @ApiProperty({ enum: WorkspaceRole })
  role!: WorkspaceRole;

  @ApiProperty({ example: 'Platform Team' })
  workspaceName!: string;

  @ApiProperty({ example: '2026-07-01T00:00:00.000Z' })
  expiresAt!: string;

  @ApiProperty({ example: true })
  requiresSignUp!: boolean;
}
