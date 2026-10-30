import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum SearchEntityType {
  ALL = 'all',
  ISSUES = 'issues',
  TICKETS = 'tickets',
  PROJECTS = 'projects',
  EPICS = 'epics',
  SPRINTS = 'sprints',
  USERS = 'users',
}

export class SearchQueryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Search query must not exceed 100 characters.' })
  q?: string;

  /**
   * Search alias for 'q'
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Search parameter must not exceed 100 characters.' })
  search?: string;

  /**
   * Filter by entity type: all, issues, tickets, projects, epics, sprints, users.
   * Can also be a comma-separated list of types (e.g. 'issues,epics').
   */
  @Transform(({ value }) => {
    if (!value) return SearchEntityType.ALL;
    const lower = String(value).toLowerCase().trim();
    return lower;
  })
  @IsOptional()
  type?: string = SearchEntityType.ALL;

  /**
   * Scopes search to a specific project by project ID or project key (e.g. 'INB', 'CSP').
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  projectId?: string;

  /**
   * Optional project alias
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  project?: string;

  /**
   * Results limit per entity category or total.
   */
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer.' })
  @Min(1, { message: 'limit must not be less than 1.' })
  @Max(100, { message: 'limit must not be greater than 100.' })
  @IsOptional()
  limit?: number = 10;

  /**
   * Page number for pagination.
   */
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer.' })
  @Min(1, { message: 'page must not be less than 1.' })
  @IsOptional()
  page?: number = 1;
}
