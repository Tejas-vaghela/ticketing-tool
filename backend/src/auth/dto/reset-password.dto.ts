import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'token must not be empty.' })
  token!: string;

  @IsString()
  @IsNotEmpty({ message: 'newPassword must not be empty.' })
  @MinLength(8, { message: 'newPassword must be at least 8 characters.' })
  @MaxLength(128, { message: 'newPassword must not exceed 128 characters.' })
  newPassword!: string;

  @IsString()
  @IsNotEmpty({ message: 'confirmPassword must not be empty.' })
  confirmPassword!: string;
}
