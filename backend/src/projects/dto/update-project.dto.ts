import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  MaxLength,
} from 'class-validator';
import { ProjectStatus } from '@prisma/client';

export class UpdateProjectDto {
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Project name must not exceed 100 characters' })
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000, { message: 'Description must not exceed 1000 characters' })
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50, { message: 'Category must not exceed 50 characters' })
  category?: string;

  @IsString()
  @IsOptional()
  leadId?: string;

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
