import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CommentType } from '@prisma/client';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsEnum(CommentType)
  @IsOptional()
  type?: CommentType;
}
