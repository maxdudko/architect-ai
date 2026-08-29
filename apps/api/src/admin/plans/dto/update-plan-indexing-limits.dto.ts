import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { IndexingResourceMetric } from '@prisma/client';

export class UpdatePlanIndexingLimitItemDto {
  @ApiProperty({ enum: IndexingResourceMetric })
  @IsEnum(IndexingResourceMetric)
  metric!: IndexingResourceMetric;

  @ApiPropertyOptional({ nullable: true, minimum: 0 })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(0)
  maxValue!: number | null;
}

export class UpdatePlanIndexingLimitsDto {
  @ApiProperty({ type: [UpdatePlanIndexingLimitItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePlanIndexingLimitItemDto)
  limits!: UpdatePlanIndexingLimitItemDto[];
}
