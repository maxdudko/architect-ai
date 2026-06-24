import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RepositoryProvider } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateRepositoryDto {
  @ApiProperty({ enum: RepositoryProvider, example: RepositoryProvider.GITHUB })
  @IsEnum(RepositoryProvider)
  provider!: RepositoryProvider;

  @ApiProperty({ example: '123456789' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  externalId!: string;

  @ApiProperty({ example: 'acme-corp' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  owner!: string;

  @ApiProperty({ example: 'platform-api' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ example: 'acme-corp/platform-api' })
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  fullName!: string;

  @ApiPropertyOptional({ example: 'main', default: 'main' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(/^[A-Za-z0-9._/-]+$/, {
    message: 'defaultBranch contains invalid characters',
  })
  defaultBranch?: string;
}
