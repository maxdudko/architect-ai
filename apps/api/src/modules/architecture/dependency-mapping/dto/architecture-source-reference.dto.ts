import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SymbolRelationType } from '@prisma/client';

/**
 * The single source reference shape for Phase 2 (spec EV-2).
 *
 * Field names match `CodeSymbolResponseDto` so the web application can render
 * an architecture reference with the same components it already uses for
 * symbols, rather than learning a fourth reference shape.
 */
export class ArchitectureSourceReferenceDto {
  @ApiProperty()
  repositoryId!: string;

  @ApiProperty()
  filePath!: string;

  @ApiPropertyOptional({
    description:
      'Start line where available. Import relationships are recorded against the file module symbol, so they carry no line.',
  })
  startLine?: number | null;

  @ApiPropertyOptional()
  endLine?: number | null;

  @ApiPropertyOptional()
  name?: string | null;

  @ApiPropertyOptional()
  qualifiedName?: string | null;

  @ApiProperty({ enum: SymbolRelationType })
  relationType!: SymbolRelationType;
}
