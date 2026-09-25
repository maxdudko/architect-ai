import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Module keys are folder paths, so they travel as query parameters. */
const MAX_MODULE_KEY_LENGTH = 512;

export class ModuleDetailQueryDto {
  @ApiProperty({
    description: 'Module key as returned by the dependency map view.',
    example: 'apps/api',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MODULE_KEY_LENGTH)
  key!: string;
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
}
