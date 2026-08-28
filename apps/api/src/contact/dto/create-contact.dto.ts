import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateContactDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'jane@company.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'I have a question about Architect AI.' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message!: string;
}
