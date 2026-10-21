import { UserRole } from '@prisma/client';

export class ActivityUserDto {
  id!: string;
  name!: string;
  email!: string;
  avatar!: string | null;
  role!: UserRole;
}

export class ActivityIssueDto {
  id!: string;
  title!: string;
}

export class ActivityProjectDto {
  id!: string;
  key!: string;
  name!: string;
}

export class ActivityEventResponseDto {
  id!: string;
  issueId!: string | null;
  projectId!: string | null;
  userId!: string;
  action!: string;
  details!: string;
  timestamp!: Date;
  user?: ActivityUserDto;
  issue?: ActivityIssueDto | null;
  project?: ActivityProjectDto | null;
}
