import { IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { SupportLevel } from '@prisma/client';

export class EscalateIssueDto {
  @IsEnum(SupportLevel)
  @IsNotEmpty()
  toLevel!: SupportLevel;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  reason!: string;

  @IsString()
  @IsOptional()
  assignedToUserId?: string;
}
