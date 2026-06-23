import { ApiPropertyOptional } from '@nestjs/swagger';
import { WorkspacePlan } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ example: 'Platform Team Workspace' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: WorkspacePlan })
  @IsOptional()
  @IsEnum(WorkspacePlan)
  plan?: WorkspacePlan;
}
