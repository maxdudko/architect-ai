import { ApiPropertyOptional } from '@nestjs/swagger';
import { SystemLogCategory, SystemLogLevel } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

function toOptionalDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }
  if (value === '') {
    return undefined;
  }
  return new Date(value);
}

export class ListLogsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @ApiPropertyOptional({
    description: 'Search by event, message, route, or request id',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: SystemLogCategory })
  @IsOptional()
  @IsEnum(SystemLogCategory)
  category?: SystemLogCategory;

  @ApiPropertyOptional({ enum: SystemLogLevel })
  @IsOptional()
  @IsEnum(SystemLogLevel)
  level?: SystemLogLevel;

  @ApiPropertyOptional({
    description: 'Inclusive start of createdAt range (ISO)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalDate(value))
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({
    description: 'Inclusive end of createdAt range (ISO)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalDate(value))
  @IsDate()
  to?: Date;

  @ApiPropertyOptional({
    default: false,
    description: 'Exclude HTTP OPTIONS (CORS preflight) request logs when true',
  })
  @IsOptional()
  @Transform(({ value }): boolean => {
    if (value === true || value === 'true' || value === '1') {
      return true;
    }
    return false;
  })
  @IsBoolean()
  excludeOptions = false;
}
