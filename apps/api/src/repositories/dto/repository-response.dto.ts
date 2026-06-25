import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RepositoryProvider, RepositoryStatus } from '@prisma/client';

export class RepositoryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty({ enum: RepositoryProvider })
  provider!: RepositoryProvider;

  @ApiProperty()
  externalId!: string;

  @ApiProperty()
  owner!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  defaultBranch!: string;

  @ApiProperty({ enum: RepositoryStatus })
  status!: RepositoryStatus;

  @ApiPropertyOptional({ example: '2026-06-24T00:00:00.000Z' })
  lastIndexedAt?: string | null;

  @ApiPropertyOptional()
  indexingError?: string | null;

  @ApiProperty({ example: '2026-06-24T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-06-24T00:00:00.000Z' })
  updatedAt!: string;
}
