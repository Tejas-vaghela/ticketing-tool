import { IsOptional, IsString, MaxLength, IsObject } from 'class-validator';

export class UpdateFilterDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  name?: string;

  @IsObject()
  @IsOptional()
  filters?: Record<string, any>;
}
