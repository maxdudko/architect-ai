import { ApiProperty } from '@nestjs/swagger';

export class RepositoryFileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  repositoryId!: string;

  @ApiProperty()
  path!: string;

  @ApiProperty()
  language!: string;

  @ApiProperty()
  size!: number;

  @ApiProperty()
  lineCount!: number;

  @ApiProperty()
  extension!: string;

  @ApiProperty()
  generated!: boolean;

  @ApiProperty()
  ignored!: boolean;

  @ApiProperty()
  binary!: boolean;

  @ApiProperty({ example: '2026-06-24T00:00:00.000Z' })
  createdAt!: string;
}
