import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SwitchWorkspaceDto {
  @ApiPropertyOptional({
    description:
      'Deprecated: refresh token is read from an httpOnly cookie. Body value is accepted only as a fallback.',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
