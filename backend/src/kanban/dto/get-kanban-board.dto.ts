import { IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { IssueStatus, Priority, SupportLevel } from '@prisma/client';
import { normalizeIssueStatus } from '../../issues/status-mapper.js';

export class GetKanbanBoardDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  q?: string;

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

  @Transform(({ value }) => {
    if (!value || String(value).toUpperCase() === 'ALL') return undefined;
    return value;
  })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @Transform(({ value }) => {
    if (!value || String(value).toUpperCase() === 'ALL') return undefined;
    return normalizeIssueStatus(value) ?? value;
  })
  @IsEnum(IssueStatus)
  @IsOptional()
  status?: IssueStatus;

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

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  @IsOptional()
  limit?: number = 200;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;
}
