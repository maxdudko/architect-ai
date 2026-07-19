import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CodeSymbolType } from '@prisma/client';

export class CodeSymbolResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  repositoryId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  qualifiedName!: string;

  @ApiProperty({ enum: CodeSymbolType })
  type!: CodeSymbolType;

  @ApiProperty()
  filePath!: string;

  @ApiProperty()
  language!: string;

  @ApiProperty()
  startLine!: number;

  @ApiProperty()
  endLine!: number;

  @ApiPropertyOptional()
  fileId?: string | null;

  @ApiProperty({ example: '2026-06-24T00:00:00.000Z' })
  createdAt!: string;
}
