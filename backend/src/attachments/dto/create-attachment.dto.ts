import { IsString, IsNotEmpty, IsInt, Min, Max, MaxLength } from 'class-validator';

export class CreateAttachmentDto {
  @IsString()
  @IsNotEmpty({ message: 'Filename must not be empty' })
  @MaxLength(255, { message: 'Filename must not exceed 255 characters' })
  filename!: string;

  @IsString()
  @IsNotEmpty({ message: 'fileType must not be empty' })
  @MaxLength(100, { message: 'fileType must not exceed 100 characters' })
  fileType!: string;

  @IsInt({ message: 'fileSize must be an integer' })
  @Min(1, { message: 'fileSize must be at least 1 byte' })
  @Max(26214400, { message: 'fileSize must not exceed 25MB (26214400 bytes)' })
  fileSize!: number;
}
