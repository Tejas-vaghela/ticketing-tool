import { IsEnum, IsNotEmpty, IsString, IsOptional, MinLength } from 'class-validator';
import { SupportLevel } from '@prisma/client';

export class EscalateIssueDto {
  @IsEnum(SupportLevel)
  @IsNotEmpty()
  toLevel: SupportLevel;

  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Escalation reason must provide at least 10 characters of technical context' })
  reason: string;

  @IsString()
  @IsOptional()
  assignedToUserId?: string;
}
