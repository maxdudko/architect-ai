import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class GithubConnectUrlQueryDto {
  @ApiPropertyOptional({
    description: 'Workspace id used to scope follow-up repository browsing',
  })
  @IsOptional()
  @IsUUID()
  workspaceId?: string;
}
