import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  Issue,
  IssueStatus,
  Priority,
  SupportLevel,
  IssueType,
  CommentType,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { EscalateIssueDto } from './dto/escalate-issue.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

const DEFAULT_SLA_RULES: Record<string, { response: number; resolution: number }> = {
  Highest: { response: 1, resolution: 4 },
  High: { response: 2, resolution: 8 },
  Medium: { response: 4, resolution: 24 },
  Low: { response: 8, resolution: 48 },
  Lowest: { response: 12, resolution: 72 },
};

export const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  department: true,
  supportLevels: true,
  avatar: true,
  timezone: true,
  status: true,
} as const;

function normalizeStatus(statusStr: string): IssueStatus {
  const s = statusStr.trim();
  if (s === 'To Do' || s === 'To_Do') return IssueStatus.To_Do;
  if (s === 'In Progress' || s === 'In_Progress') return IssueStatus.In_Progress;
  if (s === 'In Review' || s === 'In_Review') return IssueStatus.In_Review;
  if (s === 'Open') return IssueStatus.Open;
  if (s === 'Testing') return IssueStatus.Testing;
  if (s === 'Blocked') return IssueStatus.Blocked;
  if (s === 'Resolved') return IssueStatus.Resolved;
  if (s === 'Closed') return IssueStatus.Closed;
  return IssueStatus.Open;
}

@Injectable()
export class IssuesService {
  private readonly logger = new Logger(IssuesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * List all issues with optional filtering (Optimized projection without exposing password hashes)
   */
  async findAll(query: {
    projectId?: string;
    status?: string;
    priority?: string;
    supportLevel?: string;
    assigneeId?: string;
    sprintId?: string;
    q?: string;
  }): Promise<any[]> {
    const where: Prisma.IssueWhereInput = {};

    if (query.projectId) where.projectId = query.projectId;
    if (query.status) where.status = normalizeStatus(query.status);
    if (query.priority) where.priority = query.priority as Priority;
    if (query.supportLevel) where.supportLevel = query.supportLevel as SupportLevel;
    if (query.assigneeId) {
      if (query.assigneeId === 'unassigned') {
        where.assigneeId = null;
      } else {
        where.assigneeId = query.assigneeId;
      }
    }
    if (query.sprintId) {
      if (query.sprintId === 'backlog') {
        where.sprintId = null;
      } else {
        where.sprintId = query.sprintId;
      }
    }
    if (query.q) {
      where.OR = [
        { id: { contains: query.q, mode: 'insensitive' } },
        { title: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.issue.findMany({
      where,
      orderBy: { createdDate: 'desc' },
      include: {
        assignee: { select: safeUserSelect },
        project: {
          select: {
            id: true,
            key: true,
            name: true,
            category: true,
            status: true,
          },
        },
        sprint: {
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
        epic: {
          select: {
            id: true,
            name: true,
            color: true,
            status: true,
          },
        },
        _count: {
          select: {
            comments: true,
            attachments: true,
          },
        },
      },
    });
  }

  /**
   * Find single issue by formatted ID (e.g. "INB-1002")
   */
  async findById(id: string): Promise<any> {
    const issue = await this.prisma.issue.findUnique({
      where: { id },
      include: {
        assignee: { select: safeUserSelect },
        reporter: { select: safeUserSelect },
        project: true,
        sprint: true,
        epic: true,
        comments: {
          include: { author: { select: safeUserSelect } },
          orderBy: { createdAt: 'desc' },
        },
        attachments: {
          orderBy: { uploadDate: 'asc' },
        },
        escalationHistory: {
          include: {
            escalatedByUser: { select: safeUserSelect },
            assignedToUser: { select: safeUserSelect },
          },
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!issue) {
      throw new NotFoundException(`Issue with identifier ${id} not found.`);
    }

    return issue;
  }

  /**
   * Create new issue and trigger assignment notification if assigned.
   */
  async create(dto: CreateIssueDto, currentUser: { id: string; name?: string }): Promise<any> {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });
    if (!project) {
      throw new NotFoundException(`Project ${dto.projectId} not found.`);
    }

    const prefix = project.key || 'INB';

    // Auto-generate next human-readable ID
    const existingIssues = await this.prisma.issue.findMany({
      where: { id: { startsWith: `${prefix}-` } },
      select: { id: true },
    });

    const numbers = existingIssues
      .map((i) => {
        const parts = i.id.split('-');
        const n = parseInt(parts[1], 10);
        return isNaN(n) ? 0 : n;
      })
      .filter((n) => n > 0);

    const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1001;
    const newId = `${prefix}-${nextNum}`;

    const priorityKey = dto.priority || Priority.Medium;
    const sla = DEFAULT_SLA_RULES[priorityKey] || { response: 4, resolution: 24 };

    const issue = await this.prisma.issue.create({
      data: {
        id: newId,
        projectId: dto.projectId,
        title: dto.title.trim(),
        description: dto.description?.trim() || '',
        type: dto.type || IssueType.Task,
        status: dto.status || IssueStatus.Open,
        priority: priorityKey,
        supportLevel: dto.supportLevel || SupportLevel.L1,
        assigneeId: dto.assigneeId || null,
        reporterId: currentUser.id,
        sprintId: dto.sprintId || null,
        epicId: dto.epicId || null,
        labels: dto.labels || [],
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        storyPoints: dto.storyPoints || null,
        estimatedTime: dto.estimatedTime || null,
        remainingTime: dto.estimatedTime || null,
        responseSLAHours: sla.response,
        resolutionSLAHours: sla.resolution,
      },
      include: {
        assignee: { select: safeUserSelect },
        project: true,
      },
    });

    // Audit log
    await this.prisma.activityEvent.create({
      data: {
        issueId: newId,
        projectId: dto.projectId,
        userId: currentUser.id,
        action: 'created',
        details: `created ticket ${newId} "${issue.title}" (Priority: ${issue.priority}, Level: ${issue.supportLevel})`,
      },
    });

    // Trigger Assignment Notification
    if (dto.assigneeId && dto.assigneeId !== currentUser.id) {
      await this.notificationsService.createNotification({
        userId: dto.assigneeId,
        title: 'New Ticket Assigned',
        message: `${currentUser.name || 'A team member'} assigned ${newId} "${issue.title}" to you.`,
        type: NotificationType.assignment,
        issueId: newId,
        actorId: currentUser.id,
      });
    }

    return issue;
  }

  /**
   * Update issue fields and trigger assignment notification if assignee changed.
   */
  async update(id: string, dto: UpdateIssueDto, currentUser: { id: string; name?: string }): Promise<any> {
    const existing = await this.findById(id);

    const updateData: Prisma.IssueUpdateInput = {};
    if (dto.title !== undefined) updateData.title = dto.title.trim();
    if (dto.description !== undefined) updateData.description = dto.description.trim();
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.priority !== undefined) {
      updateData.priority = dto.priority;
      const sla = DEFAULT_SLA_RULES[dto.priority] || { response: 4, resolution: 24 };
      updateData.responseSLAHours = sla.response;
      updateData.resolutionSLAHours = sla.resolution;
    }
    if (dto.supportLevel !== undefined) updateData.supportLevel = dto.supportLevel;
    if (dto.assigneeId !== undefined) {
      updateData.assignee = dto.assigneeId ? { connect: { id: dto.assigneeId } } : { disconnect: true };
    }
    if (dto.sprintId !== undefined) {
      updateData.sprint = dto.sprintId ? { connect: { id: dto.sprintId } } : { disconnect: true };
    }
    if (dto.epicId !== undefined) {
      updateData.epic = dto.epicId ? { connect: { id: dto.epicId } } : { disconnect: true };
    }
    if (dto.labels !== undefined) updateData.labels = dto.labels;
    if (dto.dueDate !== undefined) updateData.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.storyPoints !== undefined) updateData.storyPoints = dto.storyPoints;
    if (dto.estimatedTime !== undefined) updateData.estimatedTime = dto.estimatedTime;
    if (dto.remainingTime !== undefined) updateData.remainingTime = dto.remainingTime;
    if (dto.isEscalated !== undefined) updateData.isEscalated = dto.isEscalated;

    const updated = await this.prisma.issue.update({
      where: { id },
      data: updateData,
      include: {
        assignee: { select: safeUserSelect },
        project: true,
      },
    });

    // Trigger Assignment Notification if reassigned
    if (dto.assigneeId && dto.assigneeId !== existing.assigneeId) {
      await this.notificationsService.createNotification({
        userId: dto.assigneeId,
        title: 'Ticket Assigned',
        message: `You have been assigned ${id} "${updated.title}".`,
        type: NotificationType.assignment,
        issueId: id,
        actorId: currentUser.id,
      });
    }

    return updated;
  }

  /**
   * Update issue status and trigger Status Change notification.
   */
  async updateStatus(
    id: string,
    statusStr: string,
    currentUser: { id: string; name?: string },
  ): Promise<any> {
    const existing = await this.findById(id);
    const newStatus = normalizeStatus(statusStr);

    const updated = await this.prisma.issue.update({
      where: { id },
      data: { status: newStatus },
      include: {
        assignee: { select: safeUserSelect },
        project: true,
      },
    });

    // Log Activity
    await this.prisma.activityEvent.create({
      data: {
        issueId: id,
        projectId: existing.projectId,
        userId: currentUser.id,
        action: 'status_changed',
        details: `moved ${id} from ${existing.status} to ${statusStr}`,
      },
    });

    // Trigger Status Change Notification to assignee and reporter
    const recipients = new Set<string>();
    if (existing.assigneeId) recipients.add(existing.assigneeId);
    if (existing.reporterId) recipients.add(existing.reporterId);

    for (const recipientId of recipients) {
      await this.notificationsService.createNotification({
        userId: recipientId,
        title: `Status Changed: ${id}`,
        message: `Ticket ${id} moved to ${statusStr}.`,
        type: NotificationType.status,
        issueId: id,
        actorId: currentUser.id,
      });
    }

    return updated;
  }

  /**
   * Support Escalation: atomically escalate tier, log escalation record, post internal comment,
   * update issue, and trigger Escalation notification.
   */
  async escalate(
    id: string,
    dto: EscalateIssueDto,
    currentUser: { id: string; name?: string },
  ): Promise<any> {
    const existing = await this.findById(id);

    return await this.prisma.$transaction(async (tx) => {
      // 1. Create EscalationRecord
      await tx.escalationRecord.create({
        data: {
          issueId: id,
          fromLevel: existing.supportLevel,
          toLevel: dto.toLevel,
          reason: dto.reason.trim(),
          escalatedByUserId: currentUser.id,
          assignedToUserId: dto.assignedToUserId || existing.assigneeId,
        },
      });

      // 2. Insert automated internal note
      await tx.comment.create({
        data: {
          issueId: id,
          authorId: currentUser.id,
          type: CommentType.internal,
          content: `[Internal Escalation Note] Escalated from ${existing.supportLevel} to ${dto.toLevel}.\nReason: ${dto.reason.trim()}`,
        },
      });

      // 3. Update Issue
      const updated = await tx.issue.update({
        where: { id },
        data: {
          supportLevel: dto.toLevel,
          isEscalated: true,
          assigneeId: dto.assignedToUserId || existing.assigneeId,
        },
        include: {
          assignee: { select: safeUserSelect },
          project: true,
        },
      });

      // 4. ActivityEvent
      await tx.activityEvent.create({
        data: {
          issueId: id,
          projectId: existing.projectId,
          userId: currentUser.id,
          action: 'escalated',
          details: `escalated ${id} ${existing.supportLevel} -> ${dto.toLevel} (Reason: ${dto.reason.trim()})`,
        },
      });

      // 5. Trigger Escalation Notification
      const targetUserId = dto.assignedToUserId || existing.assigneeId;
      if (targetUserId) {
        await this.notificationsService.createNotification(
          {
            userId: targetUserId,
            title: `Ticket Escalated: ${id}`,
            message: `${id} has been escalated to ${dto.toLevel}. Reason: ${dto.reason.trim()}`,
            type: NotificationType.escalation,
            issueId: id,
            actorId: currentUser.id,
          },
          tx,
        );
      }

      return updated;
    });
  }

  /**
   * Post a comment on an issue and trigger Comment notification.
   */
  async addComment(
    issueId: string,
    dto: CreateCommentDto,
    currentUser: { id: string; name?: string },
  ): Promise<any> {
    const existing = await this.findById(issueId);

    const comment = await this.prisma.comment.create({
      data: {
        issueId,
        authorId: currentUser.id,
        content: dto.content.trim(),
        type: dto.type || CommentType.public,
      },
      include: {
        author: { select: safeUserSelect },
      },
    });

    // Log Activity
    await this.prisma.activityEvent.create({
      data: {
        issueId,
        projectId: existing.projectId,
        userId: currentUser.id,
        action: 'comment_added',
        details: `posted ${dto.type || 'public'} comment on ${issueId}`,
      },
    });

    // Trigger Comment Notification for assignee and reporter
    const recipients = new Set<string>();
    if (existing.assigneeId) recipients.add(existing.assigneeId);
    if (existing.reporterId) recipients.add(existing.reporterId);

    const snippet =
      dto.content.length > 70 ? dto.content.slice(0, 70) + '...' : dto.content;

    for (const recipientId of recipients) {
      await this.notificationsService.createNotification({
        userId: recipientId,
        title: `New Comment on ${issueId}`,
        message: `${currentUser.name || 'A team member'} commented: "${snippet}"`,
        type: NotificationType.comment,
        issueId,
        actorId: currentUser.id,
      });
    }

    return comment;
  }

  /**
   * List comments for an issue.
   */
  async listComments(issueId: string): Promise<any[]> {
    return this.prisma.comment.findMany({
      where: { issueId },
      include: { author: { select: safeUserSelect } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
