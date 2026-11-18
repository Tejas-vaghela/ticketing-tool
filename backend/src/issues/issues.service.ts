import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateIssueDto } from './dto/create-issue.dto.js';
import { UpdateIssueDto } from './dto/update-issue.dto.js';
import { EscalateIssueDto } from './dto/escalate-issue.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { QueryIssuesDto } from './dto/query-issues.dto.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { SupportLevel, Priority, Prisma, IssueStatus, NotificationType } from '@prisma/client';
import { normalizeIssueStatus } from './status-mapper.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class IssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) { }

  /**
   * Helper: Calculate SLA thresholds based on issue priority.
   */
  private getSLAHours(priority: Priority): { response: number; resolution: number } {
    switch (priority) {
      case Priority.Highest: return { response: 1.0, resolution: 4.0 };
      case Priority.High: return { response: 2.0, resolution: 8.0 };
      case Priority.Medium: return { response: 4.0, resolution: 24.0 };
      case Priority.Low: return { response: 8.0, resolution: 48.0 };
      case Priority.Lowest: return { response: 24.0, resolution: 72.0 };
      default: return { response: 4.0, resolution: 24.0 };
    }
  }

  /**
   * Create ticket with project-keyed ID (e.g. INB-1001), SLA calculations, and audit logging.
   */
  async create(dto: CreateIssueDto, reporterId: string) {
    let project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });

    if (!project) {
      project = await this.prisma.project.findUnique({
        where: { key: dto.projectId },
      });
    }

    if (!project) {
      throw new NotFoundException(`Project with ID or Key '${dto.projectId}' not found.`);
    }

    // Collision-proof sequential ID generation: find maximum numeric suffix for project
    const existingIssues = await this.prisma.issue.findMany({
      where: { projectId: project.id },
      select: { id: true },
    });
    const prefix = `${project.key}-`;
    let maxNum = 1000;
    for (const item of existingIssues) {
      if (item.id.startsWith(prefix)) {
        const numPart = parseInt(item.id.slice(prefix.length), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    }
    const nextId = `${project.key}-${maxNum + 1}`;
    const sla = this.getSLAHours(dto.priority);
    const initialStatus = dto.status
      ? (normalizeIssueStatus(dto.status) ?? IssueStatus.Open)
      : IssueStatus.Open;

    // Foreign-key integrity safeguards
    let assigneeId: string | null = null;
    if (dto.assigneeId && dto.assigneeId !== 'unassigned') {
      const userExists = await this.prisma.user.findUnique({ where: { id: dto.assigneeId } });
      if (userExists) assigneeId = dto.assigneeId;
    }

    let sprintId: string | null = null;
    if (dto.sprintId && dto.sprintId !== 'backlog') {
      const sprintExists = await this.prisma.sprint.findUnique({ where: { id: dto.sprintId } });
      if (sprintExists) sprintId = dto.sprintId;
    }

    let epicId: string | null = null;
    if (dto.epicId) {
      const epicExists = await this.prisma.epic.findUnique({ where: { id: dto.epicId } });
      if (epicExists) epicId = dto.epicId;
    }

    const createdIssue = await this.prisma.$transaction(async (tx) => {
      const issue = await tx.issue.create({
        data: {
          id: nextId,
          projectId: project.id,
          reporterId,
          title: dto.title,
          description: dto.description ?? '',
          type: dto.type,
          status: initialStatus,
          priority: dto.priority,
          supportLevel: dto.supportLevel,
          assigneeId,
          sprintId,
          epicId,
          labels: dto.labels ?? [],
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          storyPoints: dto.storyPoints,
          estimatedTime: dto.estimatedTime,
          remainingTime: dto.estimatedTime,
          responseSLAHours: sla.response,
          resolutionSLAHours: sla.resolution,
        },
        include: {
          assignee: true,
          project: true,
          sprint: true,
          epic: true,
        },
      });

      await tx.activityEvent.create({
        data: {
          issueId: issue.id,
          userId: reporterId,
          action: 'created',
          details: `Created issue ${issue.id} with priority ${issue.priority}`,
        },
      });

      return issue;
    });

    if (createdIssue.assigneeId) {
      this.notificationsService.createNotification({
        userId: createdIssue.assigneeId,
        actorId: reporterId,
        title: 'New Ticket Assigned',
        message: `You have been assigned ${createdIssue.id} "${createdIssue.title}".`,
        type: NotificationType.assignment,
        issueId: createdIssue.id,
      }).catch(() => {});
    }

    return createdIssue;
  }

  /**
   * Multi-criteria query with pagination, search, and relations.
   * Supports Kanban board filters: search query, project, sprint (including BACKLOG),
   * support tier (L1, L2, L3), assigned member (including ME and unassigned), and status.
   */
  async findAll(query: QueryIssuesDto, currentUserId?: string) {
    const {
      page = 1,
      limit = 50,
      sortBy = 'createdDate',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.IssueWhereInput = {};

    // 1. Search filter: q or search across id, title, description, labels
    const rawSearch = (query.q || query.search || '').trim();
    if (rawSearch) {
      where.OR = [
        { id: { contains: rawSearch, mode: 'insensitive' } },
        { title: { contains: rawSearch, mode: 'insensitive' } },
        { description: { contains: rawSearch, mode: 'insensitive' } },
        { labels: { has: rawSearch } },
      ];
    }

    // 2. Project filter: projectId or project (key or ID, handles 'ALL')
    const rawProject = (query.projectId || query.project || '').trim();
    if (rawProject && rawProject.toUpperCase() !== 'ALL') {
      const proj = await this.prisma.project.findFirst({
        where: { OR: [{ id: rawProject }, { key: rawProject }] },
      });
      where.projectId = proj ? proj.id : rawProject;
    }

    // 3. Sprint filter: sprintId or sprint (handles 'ALL' and 'BACKLOG' / 'backlog')
    const rawSprint = (query.sprintId || query.sprint || '').trim();
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

    // 4. Support tier / level filter: supportLevel or supportTier or tier (handles 'ALL')
    const rawTier = (query.supportLevel || query.supportTier || query.tier || '').trim();
    if (rawTier && rawTier.toUpperCase() !== 'ALL') {
      const upperTier = rawTier.toUpperCase();
      if (upperTier === 'L1' || upperTier === 'L2' || upperTier === 'L3') {
        where.supportLevel = upperTier as SupportLevel;
      }
    }

    // 5. Assigned member filter: assigneeId, assignee, assignedMember, member (handles 'ALL', 'unassigned', 'ME')
    const rawAssignee = (
      query.assigneeId ||
      query.assignee ||
      query.assignedMember ||
      query.member ||
      ''
    ).trim();
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

    // 6. Status filter (maps board labels or enum names, handles 'ALL')
    if (query.status) {
      const mappedStatus = normalizeIssueStatus(query.status) || query.status;
      where.status = mappedStatus;
    }

    // 7. Priority filter
    if (query.priority) {
      where.priority = query.priority;
    }

    // 8. Escalation filter
    if (typeof query.isEscalated === 'boolean') {
      where.isEscalated = query.isEscalated;
    }

    const [data, total] = await Promise.all([
      this.prisma.issue.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          assignee: { select: { id: true, name: true, email: true, avatar: true } },
          project: { select: { id: true, key: true, name: true } },
          sprint: { select: { id: true, name: true, status: true } },
          epic: { select: { id: true, name: true, color: true } },
          escalationHistory: {
            orderBy: { timestamp: 'desc' },
          },
        },
      }),
      this.prisma.issue.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieve single issue with comments, attachments, and escalation history.
   */
  async findOne(id: string) {
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
   * Update mutable fields.
   */
  async update(id: string, dto: UpdateIssueDto, userId: string) {
    const issue = await this.findOne(id);

    const data: Prisma.IssueUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.supportLevel !== undefined) data.supportLevel = dto.supportLevel;
    if (dto.labels !== undefined) data.labels = dto.labels;
    if (dto.storyPoints !== undefined) data.storyPoints = dto.storyPoints;
    if (dto.estimatedTime !== undefined) data.estimatedTime = dto.estimatedTime;
    if (dto.remainingTime !== undefined) data.remainingTime = dto.remainingTime;

    if (dto.priority !== undefined) {
      data.priority = dto.priority;
      const sla = this.getSLAHours(dto.priority);
      data.responseSLAHours = sla.response;
      data.resolutionSLAHours = sla.resolution;
    }

    if (dto.status !== undefined) {
      const targetStatus = normalizeIssueStatus(dto.status);
      if (!targetStatus) {
        throw new BadRequestException(`Invalid issue status '${dto.status}'.`);
      }
      data.status = targetStatus;
      // Record response SLA milestone
      if (issue.status === 'Open' && targetStatus !== 'Open' && !issue.firstRespondedAt) {
        data.firstRespondedAt = new Date();
      }
      // Record resolution milestone
      if (['Resolved', 'Closed'].includes(targetStatus)) {
        data.resolvedAt = new Date();
      } else if (issue.resolvedAt) {
        data.resolvedAt = null; // Reopened
      }
    }

    if (dto.dueDate !== undefined) {
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }

    if (dto.assigneeId !== undefined) {
      if (dto.assigneeId && dto.assigneeId !== 'unassigned') {
        const userExists = await this.prisma.user.findUnique({ where: { id: dto.assigneeId } });
        data.assignee = userExists ? { connect: { id: dto.assigneeId } } : { disconnect: true };
      } else {
        data.assignee = { disconnect: true };
      }
    }

    if (dto.sprintId !== undefined) {
      if (dto.sprintId && dto.sprintId !== 'backlog') {
        const sprintExists = await this.prisma.sprint.findUnique({ where: { id: dto.sprintId } });
        data.sprint = sprintExists ? { connect: { id: dto.sprintId } } : { disconnect: true };
      } else {
        data.sprint = { disconnect: true };
      }
    }

    if (dto.epicId !== undefined) {
      if (dto.epicId) {
        const epicExists = await this.prisma.epic.findUnique({ where: { id: dto.epicId } });
        data.epic = epicExists ? { connect: { id: dto.epicId } } : { disconnect: true };
      } else {
        data.epic = { disconnect: true };
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedRecord = await tx.issue.update({
        where: { id },
        data,
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

      await tx.activityEvent.create({
        data: {
          issueId: id,
          userId,
          action: 'updated',
          details: `Updated attributes on issue ${id}`,
        },
      });

      return updatedRecord;
    });

    if (dto.assigneeId && dto.assigneeId !== 'unassigned' && dto.assigneeId !== issue.assigneeId) {
      this.notificationsService.createNotification({
        userId: dto.assigneeId,
        actorId: userId,
        title: 'Ticket Reassigned',
        message: `You have been assigned ${updated.id} "${updated.title}".`,
        type: NotificationType.assignment,
        issueId: updated.id,
      }).catch(() => {});
    }

    return updated;
  }

  /**
   * Dedicated status transition (Kanban drag-and-drop).
   * Validates and maps board labels to database statuses,
   * updates status in PostgreSQL, records activity event if available,
   * and preserves SLA threshold values.
   */
  async updateStatus(id: string, dto: UpdateStatusDto, userId?: string) {
    const issue = await this.findOne(id);
    const targetStatus = normalizeIssueStatus(dto.status);
    if (!targetStatus) {
      throw new BadRequestException(
        `Invalid issue status '${dto.status}'. Allowed values: ${Object.values(IssueStatus).join(', ')} or board labels ('To Do', 'In Progress', 'In Review', 'Testing', 'Resolved', 'Closed', 'Open', 'Blocked')`,
      );
    }

    const updates: Prisma.IssueUpdateInput = { status: targetStatus };

    // Record response SLA milestone (milestone timestamps only; SLA target hours are never altered)
    if (issue.status === 'Open' && targetStatus !== 'Open' && !issue.firstRespondedAt) {
      updates.firstRespondedAt = new Date();
    }

    // Record resolution milestone
    if (['Resolved', 'Closed'].includes(targetStatus)) {
      updates.resolvedAt = new Date();
    } else if (issue.resolvedAt) {
      updates.resolvedAt = null; // Reopened
    }

    // Determine valid user for activity event if available
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

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedIssue = await tx.issue.update({
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

      // Record status change in the existing activity log if available
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
          // Gracefully continue without rolling back if activity event table or schema differs
        }
      }

      return updatedIssue;
    });

    // Notify assignee or reporter about status change
    const statusNotifyTarget = updated.assigneeId || updated.reporterId;
    if (statusNotifyTarget && statusNotifyTarget !== validUserId) {
      try {
        await this.notificationsService.createNotification({
          userId: statusNotifyTarget,
          actorId: validUserId || undefined,
          type: NotificationType.status,
          title: `Status Updated: ${updated.id}`,
          message: `Ticket status changed from ${issue.status} to ${targetStatus}`,
          issueId: updated.id,
        });
      } catch (notifErr) {
        console.warn('Failed to send status notification:', notifErr);
      }
    }

    return updated;
  }

  /**
   * Atomically escalate support tier (L1 -> L2 -> L3) with audit log and internal note.
   */
  async escalate(id: string, dto: EscalateIssueDto, userId: string) {
    const issue = await this.findOne(id);

    const tierWeight: Record<SupportLevel, number> = {
      [SupportLevel.L1]: 1,
      [SupportLevel.L2]: 2,
      [SupportLevel.L3]: 3,
    };

    if (tierWeight[dto.toLevel] <= tierWeight[issue.supportLevel]) {
      throw new BadRequestException(
        `Cannot escalate issue laterally or backwards from ${issue.supportLevel} to ${dto.toLevel}.`,
      );
    }

    let assignedToUserId = dto.assignedToUserId ?? issue.assigneeId;
    if (assignedToUserId) {
      const userExists = await this.prisma.user.findUnique({ where: { id: assignedToUserId } });
      if (!userExists) assignedToUserId = null;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create audit escalation record
      const escalationRecord = await tx.escalationRecord.create({
        data: {
          issueId: id,
          fromLevel: issue.supportLevel,
          toLevel: dto.toLevel,
          reason: dto.reason,
          escalatedByUserId: userId,
          assignedToUserId,
        },
      });

      // 2. Add automated internal comment note
      await tx.comment.create({
        data: {
          issueId: id,
          authorId: userId,
          type: 'internal',
          content: `[Internal Escalation Note] Escalated from ${issue.supportLevel} to ${dto.toLevel}.\nReason: ${dto.reason}`,
        },
      });

      // 3. Log activity event
      await tx.activityEvent.create({
        data: {
          issueId: id,
          userId,
          action: 'escalated',
          details: `Escalated ${id} (${issue.supportLevel} -> ${dto.toLevel}): ${dto.reason}`,
        },
      });

      // 4. Update issue state
      const updated = await tx.issue.update({
        where: { id },
        data: {
          supportLevel: dto.toLevel,
          isEscalated: true,
          assigneeId: assignedToUserId,
        },
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

      return { ...updated, escalationRecord };
    });

    // Notify assigned engineer or previous assignee
    const escalateTarget = assignedToUserId || issue.assigneeId || issue.reporterId;
    if (escalateTarget && escalateTarget !== userId) {
      try {
        await this.notificationsService.createNotification({
          userId: escalateTarget,
          actorId: userId,
          type: NotificationType.escalation,
          title: `Ticket Escalated: ${result.id}`,
          message: `Escalated to ${dto.toLevel}: ${dto.reason}`,
          issueId: result.id,
        });
      } catch (notifErr) {
        console.warn('Failed to send escalation notification:', notifErr);
      }
    }

    return result;
  }

  /**
   * Add a comment to an issue and dispatch a notification.
   */
  async addComment(issueId: string, dto: CreateCommentDto, authorId: string) {
    const issue = await this.findOne(issueId);

    const comment = await this.prisma.comment.create({
      data: {
        issueId,
        authorId,
        content: dto.content,
        type: dto.type || 'public',
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    try {
      await this.prisma.activityEvent.create({
        data: {
          issueId,
          userId: authorId,
          action: 'commented',
          details: `Added a comment on ${issueId}`,
        },
      });
    } catch {
      // Gracefully ignore activity event failure
    }

    // Notify issue assignee or reporter
    const notifyTarget = issue.assigneeId || issue.reporterId;
    if (notifyTarget && notifyTarget !== authorId) {
      try {
        const authorName = (comment as any).author?.name || 'Someone';
        await this.notificationsService.createNotification({
          userId: notifyTarget,
          actorId: authorId,
          type: NotificationType.comment,
          title: `New Comment on ${issue.id}`,
          message: `${authorName} commented: ${dto.content.slice(0, 100)}`,
          issueId: issue.id,
        });
      } catch (notifErr) {
        console.warn('Failed to send comment notification:', notifErr);
      }
    }

    return comment;
  }

  /**
   * List all comments for an issue.
   */
  async listComments(issueId: string) {
    await this.findOne(issueId);
    return this.prisma.comment.findMany({
      where: { issueId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Edit an existing comment.
   */
  async editComment(commentId: string, content: string, userId: string, userRole?: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) {
      throw new NotFoundException(`Comment with ID '${commentId}' not found.`);
    }

    if (comment.authorId !== userId && userRole !== 'Admin' && userRole !== 'Project_Manager') {
      throw new ForbiddenException('You do not have permission to edit this comment.');
    }

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { content },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });
  }

  /**
   * Delete an existing comment.
   */
  async deleteComment(commentId: string, userId: string, userRole?: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) {
      throw new NotFoundException(`Comment with ID '${commentId}' not found.`);
    }

    if (comment.authorId !== userId && userRole !== 'Admin' && userRole !== 'Project_Manager') {
      throw new ForbiddenException('You do not have permission to delete this comment.');
    }

    await this.prisma.comment.delete({
      where: { id: commentId },
    });

    return { success: true, deletedId: commentId, message: 'Comment successfully deleted.' };
  }

  /**
   * Remove issue permanently.
   */
  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.issue.delete({ where: { id } });
    return { success: true, deletedId: id, message: `Issue ${id} has been successfully removed.` };
  }
}
