import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsString({ message: 'emailOrId must be a string' })
  @IsNotEmpty({ message: 'emailOrId should not be empty' })
  emailOrId!: string;

  @IsString({ message: 'password must be a string' })
  @IsNotEmpty({ message: 'password should not be empty' })
  password!: string;
}
