import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class RefreshDto {
  @ApiProperty({
    description: 'Refresh token issued at sign-in or prior refresh',
  })
  @IsString()
  refreshToken!: string;

  @ApiPropertyOptional({
    description:
      'Active workspace to embed in the new access token; falls back to the refresh token claim or first membership',
  })
  @IsOptional()
  @IsUUID()
  activeWorkspaceId?: string;
}
