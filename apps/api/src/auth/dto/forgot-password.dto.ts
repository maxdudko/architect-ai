import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'john@company.com' })
  @IsEmail()
  email!: string;
}
