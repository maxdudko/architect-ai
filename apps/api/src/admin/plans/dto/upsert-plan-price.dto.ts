import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class UpsertPlanPriceDto {
  @ApiProperty({
    description: 'Price in the smallest currency unit (e.g. cents)',
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({
    default: 'usd',
    description: 'ISO 4217 currency code',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}
