import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SearchQueryDto, SearchEntityType } from './dto/search-query.dto.js';
import {
  SearchResponseDto,
  IssueSearchResult,
  ProjectSearchResult,
  EpicSearchResult,
  SprintSearchResult,
  UserSearchResult,
  UnifiedSearchResultItem,
  SearchCategorizedData,
} from './dto/search-result.dto.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Main global search entry point.
   * Searches across Issues, Projects, Epics, Sprints, and Users.
   */
  async search(dto: SearchQueryDto, currentUserId?: string): Promise<SearchResponseDto> {
    const rawSearch = (dto.q || dto.search || '').trim();
    const page = dto.page && dto.page > 0 ? dto.page : 1;
    const limit = dto.limit && dto.limit > 0 ? Math.min(dto.limit, 100) : 10;

    // Handle empty search query
    if (!rawSearch) {
      return this.buildEmptyResponse(rawSearch, page, limit);
    }

    try {
      // 1. Resolve project filter if provided
      let resolvedProjectId: string | undefined = undefined;
      const rawProject = (dto.projectId || dto.project || '').trim();
      if (rawProject && rawProject.toUpperCase() !== 'ALL') {
        const foundProject = await this.prisma.project.findFirst({
          where: {
            OR: [{ id: rawProject }, { key: rawProject }],
          },
          select: { id: true },
        });
        resolvedProjectId = foundProject ? foundProject.id : rawProject;
      }

      // 2. Parse target entity types
      const enabledTypes = this.parseEntityTypes(dto.type);
      const isSingleEntity = enabledTypes.size === 1;
      const skip = (page - 1) * limit;

      // 3. Execute parallel queries
      const [
        issuesResult,
        projectsResult,
        epicsResult,
        sprintsResult,
        usersResult,
      ] = await Promise.all([
        enabledTypes.has('issues')
          ? this.searchIssues(rawSearch, resolvedProjectId, isSingleEntity ? skip : 0, limit)
          : Promise.resolve({ items: [], total: 0 }),

        enabledTypes.has('projects')
          ? this.searchProjects(rawSearch, resolvedProjectId, isSingleEntity ? skip : 0, limit)
          : Promise.resolve({ items: [], total: 0 }),

        enabledTypes.has('epics')
          ? this.searchEpics(rawSearch, resolvedProjectId, isSingleEntity ? skip : 0, limit)
          : Promise.resolve({ items: [], total: 0 }),

        enabledTypes.has('sprints')
          ? this.searchSprints(rawSearch, resolvedProjectId, isSingleEntity ? skip : 0, limit)
          : Promise.resolve({ items: [], total: 0 }),

        enabledTypes.has('users')
          ? this.searchUsers(rawSearch, isSingleEntity ? skip : 0, limit)
          : Promise.resolve({ items: [], total: 0 }),
      ]);

      const categorized: SearchCategorizedData = {
        issues: issuesResult.items,
        projects: projectsResult.items,
        epics: epicsResult.items,
        sprints: sprintsResult.items,
        users: usersResult.items,
      };

      // 4. Flatten into unified search result items for quick navigation/modals
      const unifiedResults: UnifiedSearchResultItem[] = [
        ...issuesResult.items.map((i) => this.toUnifiedIssue(i)),
        ...projectsResult.items.map((p) => this.toUnifiedProject(p)),
        ...epicsResult.items.map((e) => this.toUnifiedEpic(e)),
        ...sprintsResult.items.map((s) => this.toUnifiedSprint(s)),
        ...usersResult.items.map((u) => this.toUnifiedUser(u)),
      ];

      const totalMatches =
        issuesResult.total +
        projectsResult.total +
        epicsResult.total +
        sprintsResult.total +
        usersResult.total;

      const totalPages = Math.ceil(totalMatches / limit) || 1;

      return {
        success: true,
        message: 'Search completed successfully',
        data: {
          query: rawSearch,
          total: totalMatches,
          page,
          limit,
          totalPages,
          results: unifiedResults,
          categorized,
          issues: issuesResult.items,
          projects: projectsResult.items,
          epics: epicsResult.items,
          sprints: sprintsResult.items,
          users: usersResult.items,
          pagination: {
            page,
            limit,
            total: totalMatches,
            totalPages,
          },
        },
        query: rawSearch,
        totalCount: totalMatches,
        issues: issuesResult.items,
        projects: projectsResult.items,
        epics: epicsResult.items,
        sprints: sprintsResult.items,
        users: usersResult.items,
      };
    } catch (error) {
      this.logger.error(`Failed to execute search for query "${rawSearch}":`, error);
      throw new InternalServerErrorException('An unexpected error occurred while executing search.');
    }
  }

  // ---------------------------------------------------------------------------
  // Entity Search Queries
  // ---------------------------------------------------------------------------

  private async searchIssues(
    rawSearch: string,
    projectId?: string,
    skip = 0,
    take = 10,
  ): Promise<{ items: IssueSearchResult[]; total: number }> {
    const where: Prisma.IssueWhereInput = {
      OR: [
        { id: { contains: rawSearch, mode: 'insensitive' } },
        { title: { contains: rawSearch, mode: 'insensitive' } },
        { description: { contains: rawSearch, mode: 'insensitive' } },
        { labels: { has: rawSearch } },
      ],
      ...(projectId ? { projectId } : {}),
    };

    const [issues, total] = await Promise.all([
      this.prisma.issue.findMany({
        where,
        skip,
        take,
        orderBy: { createdDate: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          status: true,
          priority: true,
          supportLevel: true,
          projectId: true,
          labels: true,
          createdDate: true,
          updatedDate: true,
          project: {
            select: { id: true, key: true, name: true },
          },
          assignee: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          sprint: {
            select: { id: true, name: true },
          },
          epic: {
            select: { id: true, name: true, color: true },
          },
        },
      }),
      this.prisma.issue.count({ where }),
    ]);

    const items: IssueSearchResult[] = issues.map((issue) => ({
      ...issue,
      url: `/issues/${issue.id}`,
    }));

    return { items, total };
  }

  private async searchProjects(
    rawSearch: string,
    projectId?: string,
    skip = 0,
    take = 10,
  ): Promise<{ items: ProjectSearchResult[]; total: number }> {
    const where: Prisma.ProjectWhereInput = {
      OR: [
        { key: { contains: rawSearch, mode: 'insensitive' } },
        { name: { contains: rawSearch, mode: 'insensitive' } },
        { description: { contains: rawSearch, mode: 'insensitive' } },
      ],
      ...(projectId ? { id: projectId } : {}),
    };

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take,
        orderBy: { createdDate: 'desc' },
        select: {
          id: true,
          key: true,
          name: true,
          description: true,
          status: true,
          category: true,
          createdDate: true,
          lead: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    const items: ProjectSearchResult[] = projects.map((p) => ({
      ...p,
      url: `/projects/${p.id}`,
    }));

    return { items, total };
  }

  private async searchEpics(
    rawSearch: string,
    projectId?: string,
    skip = 0,
    take =
      10,
  ): Promise<{ items: EpicSearchResult[]; total: number }> {
    const where: Prisma.EpicWhereInput = {
      OR: [
        { name: { contains: rawSearch, mode: 'insensitive' } },
        { description: { contains: rawSearch, mode: 'insensitive' } },
        { summary: { contains: rawSearch, mode: 'insensitive' } },
      ],
      ...(projectId ? { projectId } : {}),
    };

    const [epics, total] = await Promise.all([
      this.prisma.epic.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          projectId: true,
          name: true,
          description: true,
          summary: true,
          color: true,
          status: true,
          dueDate: true,
          createdAt: true,
          project: {
            select: { id: true, key: true, name: true },
          },
        },
      }),
      this.prisma.epic.count({ where }),
    ]);

    const items: EpicSearchResult[] = epics.map((e) => ({
      ...e,
      url: `/epics`,
    }));

    return { items, total };
  }

  private async searchSprints(
    rawSearch: string,
    projectId?: string,
    skip = 0,
    take = 10,
  ): Promise<{ items: SprintSearchResult[]; total: number }> {
    const where: Prisma.SprintWhereInput = {
      OR: [
        { name: { contains: rawSearch, mode: 'insensitive' } },
        { goal: { contains: rawSearch, mode: 'insensitive' } },
      ],
      ...(projectId ? { projectId } : {}),
    };

    const [sprints, total] = await Promise.all([
      this.prisma.sprint.findMany({
        where,
        skip,
        take,
        orderBy: { startDate: 'desc' },
        select: {
          id: true,
          projectId: true,
          name: true,
          goal: true,
          status: true,
          startDate: true,
          endDate: true,
          completedDate: true,
          createdAt: true,
          project: {
            select: { id: true, key: true, name: true },
          },
        },
      }),
      this.prisma.sprint.count({ where }),
    ]);

    const items: SprintSearchResult[] = sprints.map((s) => ({
      ...s,
      url: `/backlog`,
    }));

    return { items, total };
  }

  private async searchUsers(
    rawSearch: string,
    skip = 0,
    take = 10,
  ): Promise<{ items: UserSearchResult[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      OR: [
        { name: { contains: rawSearch, mode: 'insensitive' } },
        { email: { contains: rawSearch, mode: 'insensitive' } },
        { department: { contains: rawSearch, mode: 'insensitive' } },
      ],
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: true,
          avatar: true,
          status: true,
          timezone: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const items: UserSearchResult[] = users.map((u) => ({
      ...u,
      url: `/team`,
    }));

    return { items, total };
  }

  // ---------------------------------------------------------------------------
  // Helpers & Normalizers
  // ---------------------------------------------------------------------------

  private parseEntityTypes(typeParam?: string): Set<string> {
    const set = new Set<string>();
    if (!typeParam || typeParam.toLowerCase() === SearchEntityType.ALL) {
      set.add('issues');
      set.add('projects');
      set.add('epics');
      set.add('sprints');
      set.add('users');
      return set;
    }

    const parts = typeParam.split(',').map((p) => p.trim().toLowerCase());
    for (const part of parts) {
      if (part === SearchEntityType.ALL) {
        return new Set(['issues', 'projects', 'epics', 'sprints', 'users']);
      }
      if (part === SearchEntityType.ISSUES || part === SearchEntityType.TICKETS) {
        set.add('issues');
      }
      if (part === SearchEntityType.PROJECTS) {
        set.add('projects');
      }
      if (part === SearchEntityType.EPICS) {
        set.add('epics');
      }
      if (part === SearchEntityType.SPRINTS) {
        set.add('sprints');
      }
      if (part === SearchEntityType.USERS) {
        set.add('users');
      }
    }

    if (set.size === 0) {
      return new Set(['issues', 'projects', 'epics', 'sprints', 'users']);
    }
    return set;
  }

  private toUnifiedIssue(issue: IssueSearchResult): UnifiedSearchResultItem {
    return {
      entityType: 'issue',
      id: issue.id,
      title: `${issue.id}: ${issue.title}`,
      subtitle: issue.project?.name ?? issue.projectId,
      description: issue.description,
      status: issue.status,
      url: issue.url,
      metadata: {
        type: issue.type,
        priority: issue.priority,
        supportLevel: issue.supportLevel,
        assignee: issue.assignee?.name,
        labels: issue.labels,
      },
    };
  }

  private toUnifiedProject(project: ProjectSearchResult): UnifiedSearchResultItem {
    return {
      entityType: 'project',
      id: project.id,
      title: `${project.name} (${project.key})`,
      subtitle: project.category ?? 'Project',
      description: project.description,
      status: project.status,
      url: project.url,
      metadata: {
        key: project.key,
        lead: project.lead?.name,
      },
    };
  }

  private toUnifiedEpic(epic: EpicSearchResult): UnifiedSearchResultItem {
    return {
      entityType: 'epic',
      id: epic.id,
      title: epic.name,
      subtitle: epic.summary ?? (epic.project?.name ? `Project: ${epic.project.name}` : undefined),
      description: epic.description,
      status: epic.status,
      url: epic.url,
      metadata: {
        color: epic.color,
        dueDate: epic.dueDate,
        projectId: epic.projectId,
      },
    };
  }

  private toUnifiedSprint(sprint: SprintSearchResult): UnifiedSearchResultItem {
    return {
      entityType: 'sprint',
      id: sprint.id,
      title: sprint.name,
      subtitle: sprint.project?.name ? `Project: ${sprint.project.name}` : undefined,
      description: sprint.goal ?? undefined,
      status: sprint.status,
      url: sprint.url,
      metadata: {
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        projectId: sprint.projectId,
      },
    };
  }

  private toUnifiedUser(user: UserSearchResult): UnifiedSearchResultItem {
    return {
      entityType: 'user',
      id: user.id,
      title: user.name,
      subtitle: `${user.role} • ${user.department}`,
      description: user.email,
      status: user.status,
      url: user.url,
      metadata: {
        role: user.role,
        department: user.department,
        avatar: user.avatar,
      },
    };
  }

  private buildEmptyResponse(
    query: string,
    page: number,
    limit: number,
  ): SearchResponseDto {
    const emptyCategorized: SearchCategorizedData = {
      issues: [],
      projects: [],
      epics: [],
      sprints: [],
      users: [],
    };

    return {
      success: true,
      message: query ? 'Search completed successfully' : 'No search query provided',
      data: {
        query,
        total: 0,
        page,
        limit,
        totalPages: 0,
        results: [],
        categorized: emptyCategorized,
        issues: [],
        projects: [],
        epics: [],
        sprints: [],
        users: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      },
      query,
      totalCount: 0,
      issues: [],
      projects: [],
      epics: [],
      sprints: [],
      users: [],
    };
  }
}
