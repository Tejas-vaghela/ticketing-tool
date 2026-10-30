import { IsString, IsNotEmpty, IsDateString, IsOptional, MaxLength, IsEnum } from 'class-validator';
import { SprintStatus } from '@prisma/client';

export class CreateSprintDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  goal?: string;

  @IsEnum(SprintStatus)
  @IsOptional()
  status?: SprintStatus = SprintStatus.planned;
}
