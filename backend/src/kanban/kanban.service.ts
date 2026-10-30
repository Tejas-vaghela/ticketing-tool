import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GetKanbanBoardDto } from './dto/get-kanban-board.dto.js';
import { UpdateKanbanStatusDto } from './dto/update-kanban-status.dto.js';
import { MoveKanbanIssueDto } from './dto/move-kanban-issue.dto.js';
import { IssueStatus, SupportLevel, Prisma } from '@prisma/client';
import { normalizeIssueStatus } from '../issues/status-mapper.js';

export interface KanbanColumnDefinition {
  id: string;
  dbStatus: IssueStatus;
  title: string;
  color: string;
  order: number;
}

export const KANBAN_COLUMNS: KanbanColumnDefinition[] = [
  { id: 'To Do', dbStatus: IssueStatus.To_Do, title: 'To Do', color: 'border-slate-300 dark:border-slate-700', order: 1 },
  { id: 'In Progress', dbStatus: IssueStatus.In_Progress, title: 'In Progress', color: 'border-indigo-400 dark:border-indigo-600', order: 2 },
  { id: 'In Review', dbStatus: IssueStatus.In_Review, title: 'In Review', color: 'border-amber-400 dark:border-amber-600', order: 3 },
  { id: 'Testing', dbStatus: IssueStatus.Testing, title: 'Testing / QA', color: 'border-cyan-400 dark:border-cyan-600', order: 4 },
  { id: 'Resolved', dbStatus: IssueStatus.Resolved, title: 'Resolved', color: 'border-emerald-400 dark:border-emerald-600', order: 5 },
  { id: 'Closed', dbStatus: IssueStatus.Closed, title: 'Closed', color: 'border-zinc-300 dark:border-zinc-700', order: 6 },
];

@Injectable()
export class KanbanService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return predefined workflow columns and their visual metadata.
   */
  getColumns(): KanbanColumnDefinition[] {
    return KANBAN_COLUMNS;
  }

  /**
   * Fetch board data with issues filtered from PostgreSQL and grouped by Kanban column.
   */
  async getBoard(dto: GetKanbanBoardDto, currentUserId?: string) {
    const { page = 1, limit = 200 } = dto;
    const where: Prisma.IssueWhereInput = {};

    // 1. Search keyword filter (matches id, title, description, labels)
    const rawSearch = (dto.q || dto.search || '').trim();
    if (rawSearch) {
      where.OR = [
        { id: { contains: rawSearch, mode: 'insensitive' } },
        { title: { contains: rawSearch, mode: 'insensitive' } },
        { description: { contains: rawSearch, mode: 'insensitive' } },
        { labels: { has: rawSearch } },
      ];
    }

    // 2. Project filter: projectId or project key
    const rawProject = (dto.projectId || dto.project || '').trim();
    if (rawProject && rawProject.toUpperCase() !== 'ALL') {
      const proj = await this.prisma.project.findFirst({
        where: { OR: [{ id: rawProject }, { key: rawProject }] },
      });
      where.projectId = proj ? proj.id : rawProject;
    }

    // 3. Sprint filter: sprintId, handling 'ALL' and 'BACKLOG'
    const rawSprint = (dto.sprintId || dto.sprint || '').trim();
    if (rawSprint && rawSprint.toUpperCase() !== 'ALL') {
      if (
        rawSprint.toUpperCase() === 'BACKLOG' ||
        rawSprint.toLowerCase() === 'none' ||
        rawSprint === 'null'
      ) {
        where.sprintId = null;
      } else {
        where.sprintId = rawSprint;
      }
    }

    // 4. Support tier filter
    const rawTier = (dto.supportLevel || dto.supportTier || dto.tier || '').trim();
    if (rawTier && rawTier.toUpperCase() !== 'ALL') {
      const upperTier = rawTier.toUpperCase();
      if (upperTier === 'L1' || upperTier === 'L2' || upperTier === 'L3') {
        where.supportLevel = upperTier as SupportLevel;
      }
    }

    // 5. Assigned member filter (handles user ID, 'unassigned', and 'ME')
    const rawAssignee = (dto.assigneeId || dto.assignee || dto.assignedMember || '').trim();
    if (rawAssignee && rawAssignee.toUpperCase() !== 'ALL') {
      if (
        rawAssignee.toLowerCase() === 'unassigned' ||
        rawAssignee.toLowerCase() === 'none' ||
        rawAssignee === 'null'
      ) {
        where.assigneeId = null;
      } else if (rawAssignee.toUpperCase() === 'ME') {
        if (currentUserId) {
          where.assigneeId = currentUserId;
        }
      } else {
        where.assigneeId = rawAssignee;
      }
    }

    // 6. Status filter
    if (dto.status) {
      where.status = dto.status;
    }

    // 7. Priority filter
    if (dto.priority) {
      where.priority = dto.priority;
    }

    const [issues, totalCount] = await Promise.all([
      this.prisma.issue.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedDate: 'desc' },
        include: {
          assignee: { select: { id: true, name: true, email: true, avatar: true } },
          project: { select: { id: true, key: true, name: true } },
          sprint: { select: { id: true, name: true, status: true } },
          epic: { select: { id: true, name: true, color: true } },
          escalationHistory: { orderBy: { timestamp: 'desc' } },
        },
      }),
      this.prisma.issue.count({ where }),
    ]);

    // Group issues by board column for convenience
    const groupedIssues: Record<string, typeof issues> = {
      'To Do': [],
      'In Progress': [],
      'In Review': [],
      'Testing': [],
      'Resolved': [],
      'Closed': [],
    };

    for (const issue of issues) {
      if (issue.status === IssueStatus.To_Do || issue.status === IssueStatus.Open) {
        groupedIssues['To Do'].push(issue);
      } else if (issue.status === IssueStatus.In_Progress) {
        groupedIssues['In Progress'].push(issue);
      } else if (issue.status === IssueStatus.In_Review) {
        groupedIssues['In Review'].push(issue);
      } else if (issue.status === IssueStatus.Testing) {
        groupedIssues['Testing'].push(issue);
      } else if (issue.status === IssueStatus.Resolved) {
        groupedIssues['Resolved'].push(issue);
      } else if (issue.status === IssueStatus.Closed) {
        groupedIssues['Closed'].push(issue);
      } else {
        // Fallback for Blocked or unexpected statuses
        groupedIssues['To Do'].push(issue);
      }
    }

    return {
      columns: KANBAN_COLUMNS,
      issues,
      groupedIssues,
      totalCount,
      page,
      limit,
    };
  }

  /**
   * Retrieve single issue details with comments, attachments, and escalation history.
   */
  async getIssue(id: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id },
      include: {
        assignee: true,
        reporter: true,
        project: true,
        sprint: true,
        epic: true,
        escalationHistory: {
          include: {
            escalatedByUser: { select: { id: true, name: true } },
            assignedToUser: { select: { id: true, name: true } },
          },
          orderBy: { timestamp: 'desc' },
        },
        comments: {
          include: { author: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: 'asc' },
        },
        attachments: true,
      },
    });

    if (!issue) {
      throw new NotFoundException(`Issue with ID '${id}' was not found.`);
    }

    return issue;
  }

  /**
   * Save issue status to PostgreSQL when moved across board columns.
   * Preserves SLA target hours and records audit event in ActivityEvent.
   */
  async updateStatus(id: string, dto: UpdateKanbanStatusDto, userId?: string) {
    const issue = await this.getIssue(id);
    const targetStatus = normalizeIssueStatus(dto.status);
    if (!targetStatus) {
      throw new BadRequestException(
        `Invalid issue status '${dto.status}'. Allowed values: ${Object.values(IssueStatus).join(', ')} or board labels ('To Do', 'In Progress', 'In Review', 'Testing', 'Testing / QA', 'Resolved', 'Closed', 'Open', 'Blocked')`,
      );
    }

    const updates: Prisma.IssueUpdateInput = { status: targetStatus };

    // Record response SLA milestone
    if (issue.status === IssueStatus.Open && targetStatus !== IssueStatus.Open && !issue.firstRespondedAt) {
      updates.firstRespondedAt = new Date();
    }

    // Record resolution milestone
    if (targetStatus === IssueStatus.Resolved || targetStatus === IssueStatus.Closed) {
      updates.resolvedAt = new Date();
    } else if (issue.resolvedAt) {
      updates.resolvedAt = null; // Reopened
    }

    // Determine valid user for activity logging if available
    let validUserId: string | null = null;
    if (userId) {
      const userExists = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (userExists) validUserId = userExists.id;
    }
    if (!validUserId && issue.reporterId) {
      const reporterExists = await this.prisma.user.findUnique({
        where: { id: issue.reporterId },
        select: { id: true },
      });
      if (reporterExists) validUserId = reporterExists.id;
    }
    if (!validUserId) {
      const anyUser = await this.prisma.user.findFirst({ select: { id: true } });
      if (anyUser) validUserId = anyUser.id;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.issue.update({
        where: { id },
        data: updates,
        include: {
          assignee: true,
          project: true,
          sprint: true,
          epic: true,
          escalationHistory: {
            orderBy: { timestamp: 'desc' },
          },
        },
      });

      // Record activity event in existing activity log if available
      if (validUserId) {
        try {
          await tx.activityEvent.create({
            data: {
              issueId: id,
              userId: validUserId,
              action: 'status_changed',
              details: `Changed status of ${id} from ${issue.status} to ${targetStatus}`,
            },
          });
        } catch {
          // Gracefully continue without rolling back if activity event fails
        }
      }

      return updated;
    });
  }

  /**
   * Move issue to a destination status/column and optional sprint.
   */
  async moveIssue(id: string, dto: MoveKanbanIssueDto, userId?: string) {
    const issue = await this.getIssue(id);
    const targetStatus = normalizeIssueStatus(dto.status);
    if (!targetStatus) {
      throw new BadRequestException(`Invalid destination status '${dto.status}'.`);
    }

    const updates: Prisma.IssueUpdateInput = { status: targetStatus };

    if (dto.targetSprintId !== undefined) {
      if (dto.targetSprintId && dto.targetSprintId !== 'backlog') {
        const sprintExists = await this.prisma.sprint.findUnique({ where: { id: dto.targetSprintId } });
        updates.sprint = sprintExists ? { connect: { id: dto.targetSprintId } } : { disconnect: true };
      } else {
        updates.sprint = { disconnect: true };
      }
    }

    if (issue.status === IssueStatus.Open && targetStatus !== IssueStatus.Open && !issue.firstRespondedAt) {
      updates.firstRespondedAt = new Date();
    }

    if (targetStatus === IssueStatus.Resolved || targetStatus === IssueStatus.Closed) {
      updates.resolvedAt = new Date();
    } else if (issue.resolvedAt) {
      updates.resolvedAt = null;
    }

    let validUserId: string | null = null;
    if (userId) {
      const userExists = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (userExists) validUserId = userExists.id;
    }
    if (!validUserId && issue.reporterId) {
      const reporterExists = await this.prisma.user.findUnique({ where: { id: issue.reporterId }, select: { id: true } });
      if (reporterExists) validUserId = reporterExists.id;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.issue.update({
        where: { id },
        data: updates,
        include: {
          assignee: true,
          project: true,
          sprint: true,
          epic: true,
        },
      });

      if (validUserId) {
        try {
          await tx.activityEvent.create({
            data: {
              issueId: id,
              userId: validUserId,
              action: 'status_changed',
              details: `Moved ${id} to ${targetStatus}`,
            },
          });
        } catch {
          // Gracefully continue
        }
      }

      return updated;
    });
  }
}
