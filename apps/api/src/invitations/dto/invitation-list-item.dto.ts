import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';

export class InvitationListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'invitee@company.com' })
  email!: string;

  @ApiProperty({ enum: WorkspaceRole })
  role!: WorkspaceRole;

  @ApiProperty({ example: '2026-07-01T00:00:00.000Z' })
  expiresAt!: string;

  @ApiProperty({ example: '2026-06-24T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({
    example: 'https://app.example.com/invitations/token',
    description:
      'Accept URL for owners/admins to copy when email delivery fails',
  })
  inviteUrl!: string;
}

export class InvitationDeliveryDto extends InvitationListItemDto {
  @ApiProperty({
    description:
      'False when the invitation was saved but Resend could not send the email',
  })
  emailSent!: boolean;
}
