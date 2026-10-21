import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsArray,
  MaxLength,
  ArrayNotEmpty,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { UserRole, SupportLevel, UserStatus } from '@prisma/client';

/**
 * UpdateUserDto — all fields are optional (PATCH semantics).
 * Password changes are handled exclusively by ChangePasswordDto.
 */
export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'name must not exceed 100 characters' })
  name?: string;

  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsOptional()
  email?: string;

  @IsEnum(UserRole, { message: 'role must be a valid UserRole enum value' })
  @IsOptional()
  role?: UserRole;

  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'department must not exceed 100 characters' })
  department?: string;

  @IsArray()
  @ArrayNotEmpty({ message: 'supportLevels must contain at least one value' })
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsEnum(SupportLevel, { each: true, message: 'each supportLevel must be L1, L2, or L3' })
  @IsOptional()
  supportLevels?: SupportLevel[];

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'avatar URL must not exceed 500 characters' })
  avatar?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'timezone must not exceed 100 characters' })
  timezone?: string;

  @IsEnum(UserStatus, { message: 'status must be Active, Away, or Offline' })
  @IsOptional()
  status?: UserStatus;
}
