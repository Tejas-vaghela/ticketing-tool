import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  MaxLength,
} from 'class-validator';

export class UpdateSettingsDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  appName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  tagline?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  workspaceName?: string;

  @IsString()
  @IsOptional()
  theme?: string;

  @IsBoolean()
  @IsOptional()
  notificationsEnabled?: boolean;

  @IsObject()
  @IsOptional()
  slaSettings?: Record<string, any>;

  @IsObject()
  @IsOptional()
  notifications?: Record<string, any>;

  @IsObject()
  @IsOptional()
  preferences?: Record<string, any>;

  @IsObject()
  @IsOptional()
  slaRules?: Record<string, any>;

  @IsObject()
  @IsOptional()
  rolePageAccess?: Record<string, any>;
}

