import { IsNotEmpty, IsString, MaxLength, IsObject } from 'class-validator';

export class CreateFilterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @IsObject()
  @IsNotEmpty()
  filters!: Record<string, any>;
}
