import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { UUID_STRING_PATTERN } from '../../common/validation/uuid-string';

export class CreateCheckoutSessionDto {
  @ApiProperty({ description: 'Plan to subscribe to' })
  @IsString()
  @Matches(UUID_STRING_PATTERN)
  planId!: string;
}
