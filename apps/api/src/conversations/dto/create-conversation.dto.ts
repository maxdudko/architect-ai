import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateConversationDto {
  @ApiPropertyOptional({
    description: 'Optional repository to scope retrieval',
  })
  @IsOptional()
  @IsUUID()
  repositoryId?: string;

  @ApiPropertyOptional({ example: 'How does auth work?' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}
