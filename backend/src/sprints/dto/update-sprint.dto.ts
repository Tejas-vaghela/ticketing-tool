import {
  IsString,
  IsOptional,
  MaxLength,
  MinLength,
  IsISO8601,
} from 'class-validator';

export class UpdateSprintDto {
  @IsString()
  @IsOptional()
  @MinLength(2, { message: 'Sprint name must be at least 2 characters' })
  @MaxLength(80, { message: 'Sprint name must not exceed 80 characters' })
  name?: string;

  @IsISO8601({}, { message: 'startDate must be a valid ISO 8601 date string' })
  @IsOptional()
  startDate?: string;

  @IsISO8601({}, { message: 'endDate must be a valid ISO 8601 date string' })
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'goal must not exceed 500 characters' })
  goal?: string;
}
