import { IsString, IsOptional, IsEnum, IsBoolean, IsInt, Min, Max, IsIn } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { IssueStatus, Priority, SupportLevel } from '@prisma/client';
import { normalizeIssueStatus } from '../status-mapper.js';

export class QueryIssuesDto {
  @IsString()
  @IsOptional()
  q?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @Transform(({ value }) => {
    if (!value || String(value).toUpperCase() === 'ALL') return undefined;
    return normalizeIssueStatus(value) ?? value;
  })
  @IsEnum(IssueStatus)
  @IsOptional()
  status?: IssueStatus;

  @Transform(({ value }) => {
    if (!value || String(value).toUpperCase() === 'ALL') return undefined;
    return value;
  })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @Transform(({ value }) => {
    if (!value || String(value).toUpperCase() === 'ALL') return undefined;
    const upper = String(value).toUpperCase();
    if (upper === 'L1' || upper === 'L2' || upper === 'L3') return upper as SupportLevel;
    return value;
  })
  @IsEnum(SupportLevel)
  @IsOptional()
  supportLevel?: SupportLevel;

  @IsString()
  @IsOptional()
  supportTier?: string;

  @IsString()
  @IsOptional()
  tier?: string;

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  project?: string;

  @IsString()
  @IsOptional()
  sprintId?: string;

  @IsString()
  @IsOptional()
  sprint?: string;

  @IsString()
  @IsOptional()
  assigneeId?: string;

  @IsString()
  @IsOptional()
  assignee?: string;

  @IsString()
  @IsOptional()
  assignedMember?: string;

  @IsString()
  @IsOptional()
  member?: string;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isEscalated?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  @IsOptional()
  limit?: number = 50;

  @IsString()
  @IsOptional()
  sortBy?: string = 'createdDate';

  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
