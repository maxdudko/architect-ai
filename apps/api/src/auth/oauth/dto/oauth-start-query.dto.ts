import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class OauthStartQueryDto {
  @ApiPropertyOptional({
    description: 'Relative path to return to after OAuth completes',
  })
  @IsOptional()
  @IsString()
  next?: string;
}
