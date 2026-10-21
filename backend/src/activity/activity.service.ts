import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, ActivityEvent } from '@prisma/client';
import { QueryActivityDto } from './dto/query-activity.dto';
import { ActivityFeedResponseDto } from './dto/activity-feed-response.dto';
import { ActivityEventResponseDto } from './dto/activity-event-response.dto';

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  role: true,
} as const;

const safeIssueSelect = {
  id: true,
  title: true,
} as const;

const safeProjectSelect = {
  id: true,
  key: true,
  name: true,
} as const;

export interface CreateActivityInput {
  userId: string;
  action: string;
  details: string;
  issueId?: string;
  projectId?: string;
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/activity — Query workspace activity stream with filters & pagination
   * Ordered newest first (timestamp DESC).
   */
  async getFeed(query: QueryActivityDto): Promise<ActivityFeedResponseDto> {
    const where: Prisma.ActivityEventWhereInput = {};

    // 1. Project filtering & verification
    if (query.projectId) {
      const trimmedProj = query.projectId.trim();
      const project = await this.prisma.project.findFirst({
        where: {
          OR: [{ id: trimmedProj }, { key: trimmedProj.toUpperCase() }],
        },
        select: { id: true },
      });
      if (!project) {
        throw new NotFoundException(`Project with identifier ${query.projectId} not found.`);
      }
      where.projectId = project.id;
    }

    // 2. Issue filtering & verification
    if (query.issueId) {
      const trimmedIssue = query.issueId.trim();
      const issue = await this.prisma.issue.findUnique({
        where: { id: trimmedIssue },
        select: { id: true },
      });
      if (!issue) {
        throw new NotFoundException(`Issue with identifier ${query.issueId} not found.`);
      }
      where.issueId = issue.id;
    }

    // 3. User actor filter
    if (query.userId) {
      where.userId = query.userId.trim();
    }

    // 4. Action verb filter
    if (query.action) {
      where.action = query.action.trim();
    }

    const limit = Math.min(query.limit || 20, 100);

    // Total count for metadata
    const total = await this.prisma.activityEvent.count({ where });

    // Keyset vs Offset pagination
    if (query.page && query.page > 0) {
      const skip = (query.page - 1) * limit;
      const items = await this.prisma.activityEvent.findMany({
        where,
        take: limit,
        skip,
        orderBy: { timestamp: 'desc' },
        include: {
          user: { select: safeUserSelect },
          issue: { select: safeIssueSelect },
          project: { select: safeProjectSelect },
        },
      });

      return {
        items: items as ActivityEventResponseDto[],
        hasMore: skip + items.length < total,
        nextCursor: null,
        total,
      };
    }

    // Keyset pagination using cursor
    const items = await this.prisma.activityEvent.findMany({
      where,
      take: limit + 1, // Fetch one extra to evaluate hasMore
      skip: query.cursor ? 1 : 0,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      orderBy: { timestamp: 'desc' },
      include: {
        user: { select: safeUserSelect },
        issue: { select: safeIssueSelect },
        project: { select: safeProjectSelect },
      },
    });

    let nextCursor: string | null = null;
    let hasMore = false;

    if (items.length > limit) {
      hasMore = true;
      items.pop(); // Remove extra element
      nextCursor = items[items.length - 1]?.id || null;
    }

    return {
      items: items as ActivityEventResponseDto[],
      nextCursor,
      hasMore,
      total,
    };
  }

  /**
   * GET /api/activity/issues/:issueId or GET /api/issues/:issueId/activity
   * Returns all audit events directly attached to an issue, newest first.
   */
  async findByIssue(issueId: string): Promise<ActivityEventResponseDto[]> {
    const trimmed = issueId.trim();
    const issue = await this.prisma.issue.findUnique({
      where: { id: trimmed },
      select: { id: true },
    });

    if (!issue) {
      throw new NotFoundException(`Issue with identifier ${issueId} not found.`);
    }

    const events = await this.prisma.activityEvent.findMany({
      where: { issueId: issue.id },
      orderBy: { timestamp: 'desc' },
      include: {
        user: { select: safeUserSelect },
        issue: { select: safeIssueSelect },
        project: { select: safeProjectSelect },
      },
    });

    return events as ActivityEventResponseDto[];
  }

  /**
   * GET /api/activity/projects/:projectId or GET /api/projects/:projectId/activity
   * Returns all audit events directly attached to a project, newest first.
   */
  async findByProject(projectId: string): Promise<ActivityEventResponseDto[]> {
    const trimmed = projectId.trim();
    const project = await this.prisma.project.findFirst({
      where: {
        OR: [{ id: trimmed }, { key: trimmed.toUpperCase() }],
      },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException(`Project with identifier ${projectId} not found.`);
    }

    const events = await this.prisma.activityEvent.findMany({
      where: { projectId: project.id },
      orderBy: { timestamp: 'desc' },
      include: {
        user: { select: safeUserSelect },
        issue: { select: safeIssueSelect },
        project: { select: safeProjectSelect },
      },
    });

    return events as ActivityEventResponseDto[];
  }

  /**
   * Record an Activity Event programmatically.
   * Can participate in existing database transactions ($transaction) via optional tx client.
   */
  async logEvent(
    data: CreateActivityInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ActivityEvent> {
    if (!data.userId || !data.action || !data.details) {
      throw new BadRequestException('userId, action, and details are required to record an activity event.');
    }

    const client = tx || this.prisma;
    return client.activityEvent.create({
      data: {
        userId: data.userId,
        action: data.action,
        details: data.details,
        issueId: data.issueId || null,
        projectId: data.projectId || null,
      },
    });
  }
}
