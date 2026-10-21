import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  IsISO8601,
} from 'class-validator';
import { IssueType, IssueStatus, Priority, SupportLevel } from '@prisma/client';

export class CreateIssueDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(IssueType)
  @IsOptional()
  type?: IssueType;

  @IsEnum(IssueStatus)
  @IsOptional()
  status?: IssueStatus;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @IsEnum(SupportLevel)
  @IsOptional()
  supportLevel?: SupportLevel;

  @IsString()
  @IsOptional()
  assigneeId?: string;

  @IsString()
  @IsOptional()
  sprintId?: string;

  @IsString()
  @IsOptional()
  epicId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  labels?: string[];

  @IsISO8601()
  @IsOptional()
  dueDate?: string;

  @IsNumber()
  @IsOptional()
  storyPoints?: number;

  @IsString()
  @IsOptional()
  estimatedTime?: string;
}
