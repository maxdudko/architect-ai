import { ApiPropertyOptional } from '@nestjs/swagger';
import { GuideType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListGuidesQueryDto {
  @ApiPropertyOptional({ enum: GuideType })
  @IsOptional()
  @IsEnum(GuideType)
  type?: GuideType;

  @ApiPropertyOptional({
    description: 'Case-insensitive search across guide content and metadata',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  q?: string;
}
