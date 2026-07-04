import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GithubRepositorySummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  owner!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  defaultBranch!: string;

  @ApiProperty()
  isPrivate!: boolean;

  @ApiProperty()
  connectable!: boolean;
}

export class GithubRepositoriesResponseDto {
  @ApiProperty({ type: [GithubRepositorySummaryDto] })
  repositories!: GithubRepositorySummaryDto[];

  @ApiPropertyOptional()
  nextCursor!: string | null;
}
