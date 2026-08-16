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
import { UsageMetric } from '@prisma/client';

export class UpdatePlanLimitItemDto {
  @ApiProperty({ enum: UsageMetric })
  @IsEnum(UsageMetric)
  metric!: UsageMetric;

  @ApiPropertyOptional({ nullable: true, minimum: 0 })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(0)
  maxValue!: number | null;
}

export class UpdatePlanLimitsDto {
  @ApiProperty({ type: [UpdatePlanLimitItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePlanLimitItemDto)
  limits!: UpdatePlanLimitItemDto[];
}
