import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  IsBoolean,
  IsISO8601,
} from 'class-validator';
import { IssueType, IssueStatus, Priority, SupportLevel } from '@prisma/client';

export class UpdateIssueDto {
  @IsString()
  @IsOptional()
  title?: string;

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
  assigneeId?: string | null;

  @IsString()
  @IsOptional()
  sprintId?: string | null;

  @IsString()
  @IsOptional()
  epicId?: string | null;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  labels?: string[];

  @IsISO8601()
  @IsOptional()
  dueDate?: string | null;

  @IsNumber()
  @IsOptional()
  storyPoints?: number | null;

  @IsString()
  @IsOptional()
  estimatedTime?: string | null;

  @IsString()
  @IsOptional()
  remainingTime?: string | null;

  @IsBoolean()
  @IsOptional()
  isEscalated?: boolean;
}
