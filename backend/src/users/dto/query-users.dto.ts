import { IsEnum, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole, UserStatus, SupportLevel } from '@prisma/client';

export class QueryUsersDto {
  @IsEnum(UserRole, { message: 'role must be a valid UserRole enum value' })
  @IsOptional()
  role?: UserRole;

  @IsEnum(UserStatus, { message: 'status must be Active, Away, or Offline' })
  @IsOptional()
  status?: UserStatus;

  @IsEnum(SupportLevel, { message: 'supportLevel must be L1, L2, or L3' })
  @IsOptional()
  supportLevel?: SupportLevel;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  search?: string; // Case-insensitive match on name and email

  @IsInt()
  @Min(1, { message: 'page must not be less than 1' })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsInt()
  @Min(1, { message: 'limit must not be less than 1' })
  @Max(250, { message: 'limit must not be greater than 250' })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
