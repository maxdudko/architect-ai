import { ApiPropertyOptional } from '@nestjs/swagger';
import { SystemLogCategory, SystemLogLevel } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({
    description: 'Inclusive end of createdAt range (ISO)',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsDate()
  to?: Date;
}
