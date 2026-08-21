import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class GithubCallbackQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  error?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  error_description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  error_uri?: string;

  // GitHub includes RFC 9207 `iss` on the authorization callback.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  iss?: string;
}
