import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'n3v3r-g0nna-guess-this-token' })
  @IsString()
  @MinLength(20)
  @MaxLength(128)
  token!: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'Password must include at least one uppercase letter, one lowercase letter, and one number',
  })
  password!: string;
}
