import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ListGithubRepositoriesQueryDto {
  @ApiProperty({
    description: 'Workspace context used for access checks and connectability',
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
