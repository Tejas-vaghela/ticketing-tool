import { IsString, IsNotEmpty, IsEnum, IsOptional, IsArray, IsInt, Min, IsDateString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { IssueType, IssueStatus, Priority, SupportLevel } from '@prisma/client';
import { normalizeIssueStatus } from '../status-mapper.js';

export class CreateIssueDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(IssueType)
  type: IssueType;

  @Transform(({ value }) => (value ? normalizeIssueStatus(value) ?? value : value))
  @IsEnum(IssueStatus)
  @IsOptional()
  status?: IssueStatus;

  @IsEnum(Priority)
  priority: Priority;

  @IsEnum(SupportLevel)
  supportLevel: SupportLevel;

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

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  storyPoints?: number;

  @IsString()
  @IsOptional()
  estimatedTime?: string;
}
