import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageRole } from '@prisma/client';

export class MessageResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  conversationId!: string;

  @ApiProperty({ enum: MessageRole })
  role!: MessageRole;

  @ApiProperty()
  content!: string;

  @ApiPropertyOptional({
    description: 'Structured metadata such as retrieval sources',
  })
  metadata?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    description: 'Current user feedback rating for assistant messages',
    enum: ['HELPFUL', 'NOT_HELPFUL'],
  })
  feedbackRating?: 'HELPFUL' | 'NOT_HELPFUL' | null;

  @ApiProperty({ example: '2026-07-24T00:00:00.000Z' })
  createdAt!: string;
}
