import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { WorkspacePlan } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'Platform Team Workspace' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ enum: WorkspacePlan, default: WorkspacePlan.FREE })
  @IsOptional()
  @IsEnum(WorkspacePlan)
  plan?: WorkspacePlan;
}
