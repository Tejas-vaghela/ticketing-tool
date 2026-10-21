import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ProjectStatus } from '@prisma/client';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty({ message: 'Project key must not be empty' })
  @MinLength(2, { message: 'Project key must be at least 2 characters' })
  @MaxLength(10, { message: 'Project key must not exceed 10 characters' })
  @Matches(/^[A-Z0-9]+$/, {
    message: 'Project key must consist strictly of uppercase letters and numbers (e.g. INB, CSP, DEV1)',
  })
  key!: string;

  @IsString()
  @IsNotEmpty({ message: 'Project name must not be empty' })
  @MaxLength(100, { message: 'Project name must not exceed 100 characters' })
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000, { message: 'Description must not exceed 1000 characters' })
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50, { message: 'Category must not exceed 50 characters' })
  category?: string;

  @IsString()
  @IsNotEmpty({ message: 'leadId must not be empty' })
  leadId!: string;

  @IsArray()
  @IsString({ each: true, message: 'Each member ID must be a string' })
  @IsOptional()
  memberIds?: string[];

  @IsEnum(ProjectStatus, {
    message: 'status must be a valid ProjectStatus (Active, Planning, Completed, On_Hold)',
  })
  @IsOptional()
  status?: ProjectStatus;
}
