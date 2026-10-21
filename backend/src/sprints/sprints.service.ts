import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { CompleteSprintDto } from './dto/complete-sprint.dto';
import { QuerySprintsDto } from './dto/query-sprints.dto';
import { SprintStatus, IssueStatus, NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

export interface SprintListItem {
  id: string;
  projectId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: SprintStatus;
  goal: string | null;
  completedDate: Date | null;
  createdAt: Date;
  issueCount: number;
  totalStoryPoints: number;
  resolvedIssueCount: number;
}

export interface CompleteSprintResult {
  sprint: {
    id: string;
    projectId: string;
    name: string;
    startDate: Date;
    endDate: Date;
    status: SprintStatus;
    goal: string | null;
    completedDate: Date | null;
    createdAt: Date;
  };
  rolledOverCount: number;
  targetSprintId: string | null;
}

@Injectable()
export class SprintsService {
  private readonly logger = new Logger(SprintsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) { }

  /**
   * List all sprints for a project, optionally filtered by status, with aggregated ticket counts.
   */
  async findAll(query: QuerySprintsDto): Promise<SprintListItem[]> {
    if (query.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: query.projectId },
      });
      if (!project) {
        throw new NotFoundException(`Project with identifier ${query.projectId} not found.`);
      }
    }

    const where: any = {};
    if (query.projectId) {
      where.projectId = query.projectId;
    }
    if (query.status) {
      where.status = query.status;
    }

    const sprints = await this.prisma.sprint.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        issues: {
          select: {
            id: true,
            status: true,
            storyPoints: true,
          },
        },
      },
    });

    return sprints.map((sprint) => {
      const issueCount = sprint.issues.length;
      const totalStoryPoints = sprint.issues.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
      const resolvedIssueCount = sprint.issues.filter(
        (i) => i.status === IssueStatus.Resolved || i.status === IssueStatus.Closed,
      ).length;

      const { issues, ...sprintData } = sprint;
      return {
        ...sprintData,
        issueCount,
        totalStoryPoints,
        resolvedIssueCount,
      };
    });
  }

  /**
   * Create a new planned sprint iteration.
   */
  async create(dto: CreateSprintDto, currentUser: { id: string }): Promise<any> {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });
    if (!project) {
      throw new NotFoundException(`Project with identifier ${dto.projectId} not found.`);
    }

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format.');
    }
    if (end <= start) {
      throw new BadRequestException('endDate must be chronologically after startDate.');
    }

    return await this.prisma.$transaction(async (tx) => {
      const sprint = await tx.sprint.create({
        data: {
          projectId: dto.projectId,
          name: dto.name.trim(),
          startDate: start,
          endDate: end,
          status: SprintStatus.planned,
          goal: dto.goal ? dto.goal.trim() : null,
        },
      });

      await tx.activityEvent.create({
        data: {
          projectId: dto.projectId,
          userId: currentUser.id,
          action: 'sprint_created',
          details: JSON.stringify({
            sprintId: sprint.id,
            name: sprint.name,
            startDate: sprint.startDate,
            endDate: sprint.endDate,
            creatorId: currentUser.id,
          }),
        },
      });

      return sprint;
    });
  }

  /**
   * Update sprint metadata (name, goal, dates). Completed sprints cannot be modified.
   */
  async update(id: string, dto: UpdateSprintDto, currentUser: { id: string }): Promise<any> {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id },
    });
    if (!sprint) {
      throw new NotFoundException(`Sprint with identifier ${id} not found.`);
    }
    if (sprint.status === SprintStatus.completed) {
      throw new BadRequestException('Completed sprints cannot be modified or reopened.');
    }

    const newStart = dto.startDate ? new Date(dto.startDate) : sprint.startDate;
    const newEnd = dto.endDate ? new Date(dto.endDate) : sprint.endDate;

    if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
      throw new BadRequestException('Invalid date format.');
    }
    if (newEnd <= newStart) {
      throw new BadRequestException('endDate must be chronologically after startDate.');
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.startDate !== undefined) updateData.startDate = newStart;
    if (dto.endDate !== undefined) updateData.endDate = newEnd;
    if (dto.goal !== undefined) updateData.goal = dto.goal ? dto.goal.trim() : null;

    return await this.prisma.sprint.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Transition a planned sprint to active state.
   * Enforces the single-active-sprint rule per project using pessimistic row locking on the parent Project.
   */
  async start(id: string, currentUser: { id: string }): Promise<any> {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id },
    });
    if (!sprint) {
      throw new NotFoundException(`Sprint with identifier ${id} not found.`);
    }
    if (sprint.status === SprintStatus.completed) {
      throw new BadRequestException('Completed sprints cannot be restarted.');
    }
    if (sprint.status === SprintStatus.active) {
      throw new BadRequestException(`Sprint ${sprint.name} is already active.`);
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Lock parent Project row exclusively to serialize sprint activation for this project
      await tx.$executeRaw`SELECT id FROM "Project" WHERE id = ${sprint.projectId} FOR UPDATE`;

      // 2. Safely verify that zero other sprints are active
      const activeSprint = await tx.sprint.findFirst({
        where: { projectId: sprint.projectId, status: SprintStatus.active },
      });

      if (activeSprint && activeSprint.id !== id) {
        throw new BadRequestException(
          `Cannot start sprint. Project ${sprint.projectId} already has an active sprint: ${activeSprint.name}`,
        );
      }

      const now = new Date();
      const updated = await tx.sprint.update({
        where: { id },
        data: {
          status: SprintStatus.active,
          startDate: now,
        },
      });

      await tx.activityEvent.create({
        data: {
          projectId: sprint.projectId,
          userId: currentUser.id,
          action: 'sprint_started',
          details: JSON.stringify({
            sprintId: id,
            name: sprint.name,
            startedAt: now,
            startedBy: currentUser.id,
          }),
        },
      });

      // Notify project lead and team members about sprint start
      const project = await tx.project.findUnique({
        where: { id: sprint.projectId },
        include: { members: { select: { id: true } } },
      });
      if (project) {
        const recipients = new Set<string>();
        if (project.leadId) recipients.add(project.leadId);
        if (project.members) project.members.forEach((m) => recipients.add(m.id));

        for (const recipientId of recipients) {
          await this.notificationsService.createNotification(
            {
              userId: recipientId,
              title: `Sprint Started: ${sprint.name}`,
              message: `${sprint.name} has begun in project ${project.key}.`,
              type: NotificationType.sprint,
              actorId: currentUser.id,
            },
            tx,
          );
        }
      }

      return {
        id: updated.id,
        status: updated.status,
        startDate: updated.startDate,
        message: `Sprint ${updated.name} successfully started.`,
      };
    });
  }

  /**
   * Complete an active sprint and atomically roll over unresolved tickets to a target sprint or Backlog.
   */
  async complete(
    id: string,
    dto: CompleteSprintDto,
    currentUser: { id: string },
  ): Promise<CompleteSprintResult> {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id },
    });
    if (!sprint) {
      throw new NotFoundException(`Sprint with identifier ${id} not found.`);
    }
    if (sprint.status !== SprintStatus.active) {
      throw new BadRequestException(
        `Only active sprints can be completed. Current status: ${sprint.status}`,
      );
    }

    if (dto.targetSprintId) {
      if (dto.targetSprintId === id) {
        throw new BadRequestException('Target sprint cannot be the same as the sprint being completed.');
      }
      const targetSprint = await this.prisma.sprint.findUnique({
        where: { id: dto.targetSprintId },
      });
      if (!targetSprint) {
        throw new NotFoundException(`Target rollover sprint ${dto.targetSprintId} not found.`);
      }
      if (targetSprint.projectId !== sprint.projectId) {
        throw new BadRequestException(
          `Target sprint belongs to project ${targetSprint.projectId}, not sprint project ${sprint.projectId}.`,
        );
      }
      if (targetSprint.status === SprintStatus.completed) {
        throw new BadRequestException('Cannot roll over unresolved issues to a completed sprint.');
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      // Lock parent project row to serialize completion/rollover
      await tx.$executeRaw`SELECT id FROM "Project" WHERE id = ${sprint.projectId} FOR UPDATE`;

      // 1. Identify issues in this sprint that are NOT resolved or closed and belong to the sprint's project
      const unresolvedIssues = await tx.issue.findMany({
        where: {
          sprintId: id,
          projectId: sprint.projectId,
          status: {
            notIn: [IssueStatus.Resolved, IssueStatus.Closed],
          },
        },
        select: { id: true },
      });

      const rolledOverCount = unresolvedIssues.length;

      // 2. Reassign unresolved issues to targetSprintId (or null for Backlog)
      if (rolledOverCount > 0) {
        await tx.issue.updateMany({
          where: {
            sprintId: id,
            projectId: sprint.projectId,
            status: {
              notIn: [IssueStatus.Resolved, IssueStatus.Closed],
            },
          },
          data: {
            sprintId: dto.targetSprintId || null,
          },
        });
      }

      // 3. Mark sprint as completed
      const completedDate = new Date();
      const updatedSprint = await tx.sprint.update({
        where: { id },
        data: {
          status: SprintStatus.completed,
          completedDate,
        },
      });

      // 4. Log ActivityEvent
      await tx.activityEvent.create({
        data: {
          projectId: sprint.projectId,
          userId: currentUser.id,
          action: 'sprint_completed',
          details: JSON.stringify({
            sprintId: id,
            name: sprint.name,
            completedDate,
            rolledOverCount,
            targetSprintId: dto.targetSprintId || null,
            completedBy: currentUser.id,
          }),
        },
      });

      // 5. Notify project lead and team members about sprint completion
      const project = await tx.project.findUnique({
        where: { id: sprint.projectId },
        include: { members: { select: { id: true } } },
      });
      if (project) {
        const recipients = new Set<string>();
        if (project.leadId) recipients.add(project.leadId);
        if (project.members) project.members.forEach((m) => recipients.add(m.id));

        for (const recipientId of recipients) {
          await this.notificationsService.createNotification(
            {
              userId: recipientId,
              title: `Sprint Completed: ${sprint.name}`,
              message: `${sprint.name} has been closed. ${rolledOverCount} tickets rolled over.`,
              type: NotificationType.sprint,
              actorId: currentUser.id,
            },
            tx,
          );
        }
      }

      return {
        sprint: updatedSprint,
        rolledOverCount,
        targetSprintId: dto.targetSprintId || null,
      };
    });
  }

  /**
   * Delete a sprint. In PostgreSQL/Prisma, Issue.sprintId has onDelete: SetNull,
   * so issues safely revert to Backlog (sprintId = null) automatically.
   */
  async remove(id: string, currentUser: { id: string }): Promise<{ success: boolean; id: string; message: string }> {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id },
    });
    if (!sprint) {
      throw new NotFoundException(`Sprint with identifier ${id} not found.`);
    }

    return await this.prisma.$transaction(async (tx) => {
      await tx.sprint.delete({
        where: { id },
      });

      await tx.activityEvent.create({
        data: {
          projectId: sprint.projectId,
          userId: currentUser.id,
          action: 'sprint_deleted',
          details: JSON.stringify({
            sprintId: id,
            name: sprint.name,
            deletedBy: currentUser.id,
          }),
        },
      });

      return {
        success: true,
        id,
        message: `Sprint ${sprint.name} permanently removed. All associated issues unassigned to backlog.`,
      };
    });
  }
}
