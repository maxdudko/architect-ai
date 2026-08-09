import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class AdminSignInDto {
  @ApiProperty({ example: 'admin@architect.ai' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'AdminPassword123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
