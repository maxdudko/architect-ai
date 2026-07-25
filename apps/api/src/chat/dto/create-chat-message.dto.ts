import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateChatMessageDto {
  @ApiProperty({ example: 'How does authentication work in this repo?' })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content!: string;
}
