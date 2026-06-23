import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';
import { IsEmail, IsEnum } from 'class-validator';

export class CreateInvitationDto {
  @ApiProperty({ example: 'new-member@company.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: WorkspaceRole, default: WorkspaceRole.MEMBER })
  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole;
}
