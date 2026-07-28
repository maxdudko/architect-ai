import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength, MaxLength } from 'class-validator';

export class ResolveGithubRepositoryQueryDto {
  @ApiProperty({
    description: 'Workspace context used for access checks and connectability',
  })
  @IsUUID()
  workspaceId!: string;

  @ApiProperty({
    description:
      'GitHub repository URL (https://github.com/owner/repo) or owner/repo slug',
    example: 'https://github.com/facebook/react',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(512)
  q!: string;
}
