import { ApiProperty } from '@nestjs/swagger';
import { AnswerFeedbackRating } from '@prisma/client';

export class AnswerFeedbackResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  messageId!: string;

  @ApiProperty()
  conversationId!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: AnswerFeedbackRating })
  rating!: AnswerFeedbackRating;

  @ApiProperty({ example: '2026-08-09T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-08-09T00:00:00.000Z' })
  updatedAt!: string;
}
