import { IsNotEmpty, IsObject, IsString, IsOptional } from 'class-validator';

export class ImportSystemDto {
  @IsString()
  @IsNotEmpty({ message: 'Backup version is required.' })
  version: string;

  @IsString()
  @IsOptional()
  exportedAt?: string;

  @IsString()
  @IsOptional()
  exportedBy?: string;

  @IsObject()
  @IsNotEmpty({ message: 'Backup data payload must not be empty.' })
  data: Record<string, any>;
}
