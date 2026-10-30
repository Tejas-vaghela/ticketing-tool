import { IsString, IsDateString, IsOptional, MaxLength, IsEnum } from 'class-validator';
import { SprintStatus } from '@prisma/client';

export class UpdateSprintDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  goal?: string;

  @IsEnum(SprintStatus)
  @IsOptional()
  status?: SprintStatus;
}
