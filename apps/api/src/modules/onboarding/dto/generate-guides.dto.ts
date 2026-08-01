import { ApiPropertyOptional } from '@nestjs/swagger';
import { GuideType } from '@prisma/client';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
} from 'class-validator';

export class GenerateGuidesDto {
  @ApiPropertyOptional({
    enum: GuideType,
    isArray: true,
    description:
      'Guide types to generate; all types are generated when omitted',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(GuideType, { each: true })
  types?: GuideType[];
}
