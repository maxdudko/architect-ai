import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GithubConnectionResponseDto {
  @ApiProperty()
  connected!: boolean;

  @ApiPropertyOptional()
  login?: string;

  @ApiPropertyOptional()
  providerUserId?: string;
}
