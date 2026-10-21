import { IsString, IsNotEmpty, MinLength, MaxLength, IsOptional } from 'class-validator';

/**
 * ChangePasswordDto — handles both Admin password reset and self-service password change.
 *
 * Service-layer enforcement:
 *   - Non-Admin callers: currentPassword MUST be provided and verified against stored bcrypt hash.
 *   - If confirmPassword is provided: must match newPassword exactly.
 *   - Admin password reset: only newPassword required; currentPassword is ignored.
 */
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'newPassword must not be empty' })
  @MinLength(8, { message: 'newPassword must be at least 8 characters' })
  @MaxLength(128, { message: 'newPassword must not exceed 128 characters' })
  newPassword!: string;

  @IsString()
  @IsOptional()
  confirmPassword?: string;

  @IsString()
  @IsOptional()
  currentPassword?: string;
}
