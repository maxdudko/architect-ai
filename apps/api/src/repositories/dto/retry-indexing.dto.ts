import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RetryIndexingDto {
  @ApiPropertyOptional({ example: 'main' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(/^[A-Za-z0-9._/-]+$/, {
    message: 'branch contains invalid characters',
  })
  branch?: string;
}
