import { IsString, IsOptional } from 'class-validator';

export class CompleteSprintDto {
  @IsString()
  @IsOptional()
  targetSprintId?: string;
}
