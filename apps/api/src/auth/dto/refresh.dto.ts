import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class RefreshDto {
  @ApiPropertyOptional({
    description:
      'Deprecated: refresh token is read from an httpOnly cookie. Body value is accepted only as a fallback.',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional({
    description:
      'Active workspace to embed in the new access token; falls back to the refresh token claim or first membership',
  })
  @IsOptional()
  @IsUUID()
  activeWorkspaceId?: string;
}
