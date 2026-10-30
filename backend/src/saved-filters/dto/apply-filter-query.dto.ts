import { IsOptional, IsString } from 'class-validator';

export class ApplyFilterQueryDto {
  @IsString()
  @IsOptional()
  filterId?: string;
}
