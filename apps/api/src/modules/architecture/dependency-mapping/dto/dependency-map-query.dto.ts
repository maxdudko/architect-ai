import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { DEPENDENCY_MAP_SEARCH_MAX_LENGTH } from '../dependency-map.constants';

/** Module keys are folder paths, so they travel as query parameters. */
const MAX_MODULE_KEY_LENGTH = 512;

export class DependencyMapQueryDto {
  @ApiPropertyOptional({
    description:
      'Case-insensitive match against module path or name. At most the declared module bound is returned.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(DEPENDENCY_MAP_SEARCH_MAX_LENGTH)
  q?: string;

  @ApiPropertyOptional({
    description:
      'Succeeded indexing revision to keep this view on. Omitted means the latest succeeded revision.',
  })
  @IsOptional()
  @IsUUID()
  indexingRunId?: string;
}

export class ModuleDetailQueryDto {
  @ApiProperty({
    description: 'Module key as returned by the dependency map view.',
    example: 'apps/api',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MODULE_KEY_LENGTH)
  key!: string;

  @ApiPropertyOptional({
    description:
      'Succeeded indexing revision to read. Omitted means the latest succeeded revision.',
  })
  @IsOptional()
  @IsUUID()
  indexingRunId?: string;
}

export class DependencyEvidenceQueryDto {
  @ApiProperty({ description: 'Key of the module that depends on the target.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MODULE_KEY_LENGTH)
  from!: string;

  @ApiProperty({ description: 'Key of the module being depended upon.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MODULE_KEY_LENGTH)
  to!: string;

  @ApiPropertyOptional({
    description:
      'Succeeded indexing revision to read. Omitted means the latest succeeded revision.',
  })
  @IsOptional()
  @IsUUID()
  indexingRunId?: string;
}
