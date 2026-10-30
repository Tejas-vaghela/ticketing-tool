import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { EpicStatus } from '@prisma/client';
import { normalizeEpicStatus } from '../status-mapper.js';

export class CreateEpicDto {
  @IsString()
  @IsNotEmpty({ message: 'Project ID or Key is required' })
  projectId: string;

  @IsString()
  @IsNotEmpty({ message: 'Epic name is required' })
  @MaxLength(100, { message: 'Epic name must not exceed 100 characters' })
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000, { message: 'Description must not exceed 2000 characters' })
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255, { message: 'Summary must not exceed 255 characters' })
  summary?: string;

  @IsString()
  @IsOptional()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'Color must be a valid hex color code (e.g. #3b82f6)',
  })
  color?: string;

  @IsOptional()
  @Transform(({ value }) => (value ? normalizeEpicStatus(value) ?? value : value))
  @IsEnum(EpicStatus, {
    message: 'Status must be one of: To Do, In Progress, Done',
  })
  status?: EpicStatus = EpicStatus.To_Do;

  @IsDateString({}, { message: 'Due date must be a valid ISO-8601 date string' })
  @IsOptional()
  dueDate?: string;
}
