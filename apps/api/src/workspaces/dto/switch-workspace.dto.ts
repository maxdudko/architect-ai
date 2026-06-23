import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SwitchWorkspaceDto {
  @ApiProperty({
    description:
      'Current refresh token to rotate with the new active workspace',
  })
  @IsString()
  refreshToken!: string;
}
