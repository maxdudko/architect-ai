import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageResponseDto } from '../../conversations/dto/message-response.dto';

export class ChatSourceReferenceDto {
  @ApiProperty()
  chunkId!: string;

  @ApiProperty()
  repositoryId!: string;

  @ApiProperty()
  filePath!: string;

  @ApiPropertyOptional()
  symbolName?: string | null;

  @ApiPropertyOptional()
  qualifiedName?: string | null;

  @ApiPropertyOptional()
  startLine?: number | null;

  @ApiPropertyOptional()
  endLine?: number | null;

  @ApiProperty()
  score!: number;
}

export class ChatAnswerResponseDto {
  @ApiProperty({ type: MessageResponseDto })
  userMessage!: MessageResponseDto;

  @ApiProperty({ type: MessageResponseDto })
  assistantMessage!: MessageResponseDto;

  @ApiProperty({ type: [ChatSourceReferenceDto] })
  sources!: ChatSourceReferenceDto[];
}
