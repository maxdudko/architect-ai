import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AnswerFeedbackRating } from '@prisma/client';

export class UpsertAnswerFeedbackDto {
  @ApiProperty({ enum: AnswerFeedbackRating })
  @IsEnum(AnswerFeedbackRating)
  rating!: AnswerFeedbackRating;
}
