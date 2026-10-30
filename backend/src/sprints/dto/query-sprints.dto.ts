import { IsString, IsOptional, IsEnum } from 'class-validator';
import { SprintStatus } from '@prisma/client';

export class QuerySprintsDto {
  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  project?: string;

  @IsEnum(SprintStatus)
  @IsOptional()
  status?: SprintStatus;
}
