import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { UUID_STRING_PATTERN } from '../../../common/validation/uuid-string';

export class AssignWorkspacePlanDto {
  @ApiProperty({ description: 'Plan to assign to the workspace' })
  @IsString()
  @Matches(UUID_STRING_PATTERN)
  planId!: string;
}
