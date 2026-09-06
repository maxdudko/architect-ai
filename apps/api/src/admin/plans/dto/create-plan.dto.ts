import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({
    description:
      'Stable, URL-safe identifier (lowercase letters, numbers, hyphens)',
    example: 'growth',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'key must be lowercase letters, numbers, and hyphens only',
  })
  key!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isContactSales?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
