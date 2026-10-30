import { IsEnum, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { IssueStatus } from '@prisma/client';
import { normalizeIssueStatus } from '../status-mapper.js';

export class UpdateStatusDto {
  @Transform(({ value }) => {
    const normalized = normalizeIssueStatus(value);
    return normalized !== null ? normalized : value;
  })
  @IsEnum(IssueStatus, {
    message: `status must be a valid IssueStatus enum or board label ('To Do', 'In Progress', 'In Review', 'Testing', 'Resolved', 'Closed', 'Open', 'Blocked')`,
  })
  @IsNotEmpty()
  status: IssueStatus;
}
