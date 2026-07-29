import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ListGithubBranchesQueryDto {
  @ApiProperty({
    description: 'Workspace context used for access checks',
  })
  @IsUUID()
  workspaceId!: string;

  @ApiProperty({
    required: false,
    description: 'Opaque cursor from previous page response',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
