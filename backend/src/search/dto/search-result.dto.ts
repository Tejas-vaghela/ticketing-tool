import {
  IssueType,
  IssueStatus,
  Priority,
  SupportLevel,
  ProjectStatus,
  EpicStatus,
  SprintStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';

export interface IssueSearchResult {
  id: string;
  title: string;
  description: string;
  type: IssueType;
  status: IssueStatus;
  priority: Priority;
  supportLevel: SupportLevel;
  projectId: string;
  project?: {
    id: string;
    key: string;
    name: string;
  } | null;
  assignee?: {
    id: string;
    name: string;
    email: string;
    avatar: string;
  } | null;
  sprint?: {
    id: string;
    name: string;
  } | null;
  epic?: {
    id: string;
    name: string;
    color: string;
  } | null;
  labels: string[];
  createdDate: Date;
  updatedDate: Date;
  url: string;
}

export interface ProjectSearchResult {
  id: string;
  key: string;
  name: string;
  description: string;
  status: ProjectStatus;
  category: string | null;
  lead?: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdDate: Date;
  url: string;
}

export interface EpicSearchResult {
  id: string;
  projectId: string;
  name: string;
  description: string;
  summary: string | null;
  color: string;
  status: EpicStatus;
  dueDate: Date | null;
  createdAt: Date;
  project?: {
    id: string;
    key: string;
    name: string;
  } | null;
  url: string;
}

export interface SprintSearchResult {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  startDate: Date;
  endDate: Date;
  completedDate: Date | null;
  createdAt: Date;
  project?: {
    id: string;
    key: string;
    name: string;
  } | null;
  url: string;
}

export interface UserSearchResult {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  avatar: string;
  status: UserStatus;
  timezone: string;
  url: string;
}

export interface UnifiedSearchResultItem {
  entityType: 'issue' | 'project' | 'epic' | 'sprint' | 'user';
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  status?: string;
  url: string;
  metadata: Record<string, any>;
}

export interface SearchCategorizedData {
  issues: IssueSearchResult[];
  projects: ProjectSearchResult[];
  epics: EpicSearchResult[];
  sprints: SprintSearchResult[];
  users: UserSearchResult[];
}

export interface SearchPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SearchResponseDto {
  success: boolean;
  message: string;
  data: {
    query: string;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    results: UnifiedSearchResultItem[];
    categorized: SearchCategorizedData;
    issues: IssueSearchResult[];
    projects: ProjectSearchResult[];
    epics: EpicSearchResult[];
    sprints: SprintSearchResult[];
    users: UserSearchResult[];
    pagination: SearchPaginationMeta;
  };
  query: string;
  totalCount: number;
  issues: IssueSearchResult[];
  projects: ProjectSearchResult[];
  epics: EpicSearchResult[];
  sprints: SprintSearchResult[];
  users: UserSearchResult[];
}
