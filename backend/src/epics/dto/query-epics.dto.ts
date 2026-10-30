import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { EpicStatus } from '@prisma/client';
import { normalizeEpicStatus } from '../status-mapper.js';

export class QueryEpicsDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  project?: string;

  @IsOptional()
  @Transform(({ value }) => (value ? normalizeEpicStatus(value) ?? value : value))
  @IsEnum(EpicStatus)
  status?: EpicStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
