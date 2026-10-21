import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { SprintStatus } from '@prisma/client';

export class QuerySprintsDto {
  @IsString()
  @IsOptional()
  projectId?: string;

  @IsEnum(SprintStatus, {
    message: 'status must be a valid SprintStatus (active, future, completed, planned)',
  })
  @IsOptional()
  status?: SprintStatus;
}
