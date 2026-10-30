import { IsEnum, IsNotEmpty, IsOptional, IsInt, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { IssueStatus } from '@prisma/client';
import { normalizeIssueStatus } from '../../issues/status-mapper.js';

export class MoveKanbanIssueDto {
  @Transform(({ value }) => {
    const normalized = normalizeIssueStatus(value);
    return normalized !== null ? normalized : value;
  })
  @IsEnum(IssueStatus, {
    message: `status must be a valid IssueStatus enum or board label ('To Do', 'In Progress', 'In Review', 'Testing', 'Testing / QA', 'Resolved', 'Closed', 'Open', 'Blocked')`,
  })
  @IsNotEmpty()
  status: IssueStatus;

  @IsInt()
  @Min(0)
  @IsOptional()
  targetIndex?: number;

  @IsString()
  @IsOptional()
  targetSprintId?: string;
}
