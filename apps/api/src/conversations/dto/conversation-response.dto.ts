import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageResponseDto } from './message-response.dto';

export class ConversationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiPropertyOptional()
  repositoryId?: string | null;

  @ApiProperty()
  createdById!: string;

  @ApiPropertyOptional()
  title?: string | null;

  @ApiProperty({ example: '2026-07-24T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-24T00:00:00.000Z' })
  updatedAt!: string;
}

export class ConversationDetailResponseDto extends ConversationResponseDto {
  @ApiProperty({ type: [MessageResponseDto] })
  messages!: MessageResponseDto[];
}
