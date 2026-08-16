import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'Platform Team Workspace' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}
