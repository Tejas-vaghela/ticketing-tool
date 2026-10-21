import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ProjectStatus } from '@prisma/client';

export class QueryProjectsDto {
  @IsString()
  @IsOptional()
  q?: string;

  @IsEnum(ProjectStatus, { message: 'status must be Active, Planning, Completed, or On_Hold' })
  @IsOptional()
  status?: ProjectStatus;

  @IsString()
  @IsOptional()
  category?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;
}
