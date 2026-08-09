import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AdminLogoutDto {
  @ApiPropertyOptional({
    description: 'Refresh token to invalidate from session store',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
