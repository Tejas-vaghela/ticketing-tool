import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsEnum,
  IsOptional,
  IsArray,
  MinLength,
  MaxLength,
  ArrayNotEmpty,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { UserRole, SupportLevel, UserStatus } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'name must not be empty' })
  @MaxLength(100, { message: 'name must not exceed 100 characters' })
  name!: string;

  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty({ message: 'email must not be empty' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'password must not be empty' })
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(128, { message: 'password must not exceed 128 characters' })
  password!: string;

  @IsEnum(UserRole, { message: 'role must be a valid UserRole enum value' })
  @IsOptional()
  role?: UserRole; // Defaults to UserRole.Viewer if omitted

  @IsString()
  @IsNotEmpty({ message: 'department must not be empty' })
  @MaxLength(100, { message: 'department must not exceed 100 characters' })
  department!: string;

  @IsArray()
  @ArrayNotEmpty({ message: 'supportLevels must contain at least one value' })
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsEnum(SupportLevel, { each: true, message: 'each supportLevel must be L1, L2, or L3' })
  @IsOptional()
  supportLevels?: SupportLevel[]; // Defaults to [SupportLevel.L1]

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'avatar URL must not exceed 500 characters' })
  avatar?: string; // Defaults to "" in schema

  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'timezone must not exceed 100 characters' })
  timezone?: string; // Defaults to "UTC"

  @IsEnum(UserStatus, { message: 'status must be Active, Away, or Offline' })
  @IsOptional()
  status?: UserStatus; // Defaults to UserStatus.Active
}
