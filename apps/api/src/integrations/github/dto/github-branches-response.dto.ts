import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GithubBranchSummaryDto {
  @ApiProperty()
  name!: string;

  @ApiProperty({ description: 'Whether the branch is protected on GitHub' })
  isProtected!: boolean;
}

export class GithubBranchesResponseDto {
  @ApiProperty({ type: [GithubBranchSummaryDto] })
  branches!: GithubBranchSummaryDto[];

  @ApiProperty()
  defaultBranch!: string;

  @ApiPropertyOptional()
  nextCursor!: string | null;
}
