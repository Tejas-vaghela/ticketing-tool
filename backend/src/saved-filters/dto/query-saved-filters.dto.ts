import { IsOptional, IsString } from 'class-validator';

export class QuerySavedFiltersDto {
  @IsString()
  @IsOptional()
  search?: string;
}
