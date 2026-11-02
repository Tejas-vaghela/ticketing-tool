import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSprintDto } from './dto/create-sprint.dto.js';
import { UpdateSprintDto } from './dto/update-sprint.dto.js';
import { CompleteSprintDto } from './dto/complete-sprint.dto.js';
import { QuerySprintsDto } from './dto/query-sprints.dto.js';
import { SprintStatus, IssueStatus, Prisma } from '@prisma/client';

export interface SprintProgressMetrics {
  totalIssues: number;
  completedIssues: number;
  openIssues: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  remainingStoryPoints: number;
  progressPercentage: number;
}

@Injectable()
export class SprintsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new sprint for a project with validation and status integrity.
   */
  async create(dto: CreateSprintDto, userId?: string) {
    // 1. Resolve and validate project existence (by ID or key)
    const project = await this.prisma.project.findFirst({
      where: {
        OR: [{ id: dto.projectId }, { key: dto.projectId }],
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID or key '${dto.projectId}' was not found.`);
    }

    // 2. Validate date chronologies
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid startDate or endDate provided.');
    }
    if (endDate <= startDate) {
      throw new BadRequestException(
        `Sprint end date (${dto.endDate}) cannot be earlier than or equal to start date (${dto.startDate}).`,
      );
    }

    // 3. If starting as active, enforce single active sprint per project rule
    const targetStatus = dto.status ?? SprintStatus.planned;
    if (targetStatus === SprintStatus.active) {
      const activeSprint = await this.prisma.sprint.findFirst({
        where: { projectId: project.id, status: SprintStatus.active },
      });
      if (activeSprint) {
        throw new ConflictException(
          `Project '${project.name}' already has an active sprint ('${activeSprint.name}'). Complete it before creating another active sprint.`,
        );
      }
    }

    let created: Awaited<ReturnType<typeof this.prisma.sprint.create>> | undefined;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const sprints = (await this.prisma.sprint.findMany({ select: { id: true } })) || [];
      const highestNumber = sprints.reduce((highest, sprint) => {
        const match = /^sprint-(\d+)$/i.exec(sprint.id);
        return match ? Math.max(highest, Number(match[1])) : highest;
      }, 0);

      try {
        created = await this.prisma.sprint.create({
          data: {
            id: `sprint-${highestNumber + 1}`,
            projectId: project.id,
            name: dto.name.trim(),
            startDate,
            endDate,
            goal: dto.goal?.trim() || null,
            status: targetStatus,
          },
          include: {
            project: { select: { id: true, key: true, name: true } },
            _count: { select: { issues: true } },
          },
        });
        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          continue;
        }
        throw error;
      }
    }

    if (!created) {
      throw new ConflictException('Could not allocate a unique Sprint ID. Please try again.');
    }

    // Record audit event if user context exists
    if (userId) {
      await this.logActivity(userId, project.id, 'sprint_created', `created sprint ${created.name}`);
    }

    return created;
  }

  /**
   * Retrieve all sprints matching optional project and status filters.
   * Includes calculated story points and completion progress for each sprint.
   */
  async findAll(query?: QuerySprintsDto) {
    const where: Prisma.SprintWhereInput = {};

    if (query?.projectId || query?.project) {
      const rawProject = (query.projectId || query.project || '').trim();
      if (rawProject && rawProject.toUpperCase() !== 'ALL') {
        const proj = await this.prisma.project.findFirst({
          where: { OR: [{ id: rawProject }, { key: rawProject }] },
        });
        where.projectId = proj ? proj.id : rawProject;
      }
    }

    if (query?.status) {
      where.status = query.status;
    }

    const sprints = await this.prisma.sprint.findMany({
      where,
      include: {
        project: { select: { id: true, key: true, name: true } },
        issues: {
          select: {
            id: true,
            status: true,
            storyPoints: true,
          },
        },
        _count: { select: { issues: true } },
      },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
    });

    return sprints.map((sprint) => {
      const metrics = this.computeMetrics(sprint.issues);
      return {
        id: sprint.id,
        projectId: sprint.projectId,
        name: sprint.name,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        status: sprint.status,
        goal: sprint.goal,
        completedDate: sprint.completedDate,
        createdAt: sprint.createdAt,
        project: sprint.project,
        issueCount: sprint._count.issues,
        ...metrics,
      };
    });
  }

  /**
   * Retrieve a single sprint by ID with contained issues and rollup metrics.
   */
  async findOne(id: string) {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, key: true, name: true } },
        issues: {
          include: {
            assignee: { select: { id: true, name: true, email: true, avatar: true } },
            epic: { select: { id: true, name: true, color: true } },
          },
          orderBy: { updatedDate: 'desc' },
        },
        _count: { select: { issues: true } },
      },
    });

    if (!sprint) {
      throw new NotFoundException(`Sprint with ID '${id}' was not found.`);
    }

    const metrics = this.computeMetrics(sprint.issues);

    return {
      ...sprint,
      ...metrics,
    };
  }

  /**
   * Find sprints belonging to a specific project.
   */
  async findByProject(projectId: string) {
    return this.findAll({ projectId });
  }

  /**
   * Update mutable fields of an existing sprint.
   */
  async update(id: string, dto: UpdateSprintDto, userId?: string) {
    const sprint = await this.prisma.sprint.findUnique({ where: { id } });
    if (!sprint) {
      throw new NotFoundException(`Sprint with ID '${id}' was not found.`);
    }

    const data: Prisma.SprintUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }

    if (dto.goal !== undefined) {
      data.goal = dto.goal ? dto.goal.trim() : null;
    }

    // Date validations
    const effectiveStart = dto.startDate ? new Date(dto.startDate) : sprint.startDate;
    const effectiveEnd = dto.endDate ? new Date(dto.endDate) : sprint.endDate;

    if (dto.startDate !== undefined || dto.endDate !== undefined) {
      if (effectiveEnd <= effectiveStart) {
        throw new BadRequestException(
          `Sprint end date cannot be earlier than or equal to start date.`,
        );
      }
      if (dto.startDate !== undefined) data.startDate = effectiveStart;
      if (dto.endDate !== undefined) data.endDate = effectiveEnd;
    }

    // Status transitions
    if (dto.status !== undefined) {
      if (dto.status === SprintStatus.active && sprint.status !== SprintStatus.active) {
        const activeSprint = await this.prisma.sprint.findFirst({
          where: { projectId: sprint.projectId, status: SprintStatus.active, id: { not: id } },
        });
        if (activeSprint) {
          throw new ConflictException(
            `Project already has an active sprint ('${activeSprint.name}'). Complete it first.`,
          );
        }
      }

      data.status = dto.status;
      if (dto.status === SprintStatus.completed && !sprint.completedDate) {
        data.completedDate = new Date();
      }
    }

    const updated = await this.prisma.sprint.update({
      where: { id },
      data,
      include: {
        project: { select: { id: true, key: true, name: true } },
        _count: { select: { issues: true } },
      },
    });

    if (userId) {
      await this.logActivity(userId, sprint.projectId, 'sprint_updated', `updated sprint ${updated.name}`);
    }

    return updated;
  }

  /**
   * Start a planned sprint, transitioning it to 'active'.
   * Enforces that only one sprint is active per project.
   */
  async start(id: string, userId?: string) {
    const sprint = await this.prisma.sprint.findUnique({ where: { id } });
    if (!sprint) {
      throw new NotFoundException(`Sprint with ID '${id}' was not found.`);
    }

    if (sprint.status === SprintStatus.active) {
      return sprint;
    }

    if (sprint.status === SprintStatus.completed) {
      throw new BadRequestException('Cannot start a sprint that has already been completed.');
    }

    // Check project exclusivity
    const existingActive = await this.prisma.sprint.findFirst({
      where: {
        projectId: sprint.projectId,
        status: SprintStatus.active,
        id: { not: id },
      },
    });

    if (existingActive) {
      throw new ConflictException(
        `Project already has an active sprint ('${existingActive.name}'). Complete it before starting '${sprint.name}'.`,
      );
    }

    const started = await this.prisma.sprint.update({
      where: { id },
      data: { status: SprintStatus.active },
      include: {
        project: { select: { id: true, key: true, name: true } },
        _count: { select: { issues: true } },
      },
    });

    if (userId) {
      await this.logActivity(userId, sprint.projectId, 'sprint_started', `started sprint ${sprint.name}`);
    }

    return started;
  }

  /**
   * Complete an active sprint, set status to 'completed', and atomically roll over
   * unresolved issues to targetSprintId or the backlog.
   */
  async complete(id: string, dto: CompleteSprintDto, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const sprint = await tx.sprint.findUnique({ where: { id } });
      if (!sprint) {
        throw new NotFoundException(`Sprint with ID '${id}' was not found.`);
      }

      if (sprint.status !== SprintStatus.active) {
        throw new BadRequestException(
          `Only 'active' sprints can be completed. Current status: '${sprint.status}'.`,
        );
      }

      let destinationSprintId: string | null = null;
      if (dto.targetSprintId && dto.targetSprintId !== 'backlog') {
        const targetSprint = await tx.sprint.findUnique({ where: { id: dto.targetSprintId } });
        if (!targetSprint) {
          throw new NotFoundException(`Target rollover sprint '${dto.targetSprintId}' does not exist.`);
        }
        if (targetSprint.projectId !== sprint.projectId) {
          throw new BadRequestException(
            `Target sprint '${targetSprint.name}' belongs to a different project. Cannot roll over across projects.`,
          );
        }
        destinationSprintId = targetSprint.id;
      }

      // Mark current sprint as completed
      const updatedSprint = await tx.sprint.update({
        where: { id },
        data: {
          status: SprintStatus.completed,
          completedDate: new Date(),
        },
        include: {
          project: { select: { id: true, key: true, name: true } },
        },
      });

      // Find unresolved issues
      const incompleteIssues = await tx.issue.findMany({
        where: {
          sprintId: id,
          status: { notIn: [IssueStatus.Resolved, IssueStatus.Closed] },
        },
        select: { id: true },
      });

      const issueIds = incompleteIssues.map((i) => i.id);
      if (issueIds.length > 0) {
        await tx.issue.updateMany({
          where: { id: { in: issueIds } },
          data: { sprintId: destinationSprintId },
        });
      }

      const completedIssuesCount = await tx.issue.count({
        where: {
          sprintId: id,
          status: { in: [IssueStatus.Resolved, IssueStatus.Closed] },
        },
      });

      if (userId) {
        await tx.activityEvent.create({
          data: {
            userId,
            projectId: sprint.projectId,
            action: 'sprint_completed',
            details: `completed sprint ${sprint.name}. Rolled over ${issueIds.length} unresolved issues to ${destinationSprintId ? 'sprint ' + destinationSprintId : 'Backlog'}.`,
          },
        });
      }

      return {
        sprint: updatedSprint,
        completedIssuesCount,
        rolledOverIssuesCount: issueIds.length,
        targetSprintId: destinationSprintId,
        message: `Sprint '${sprint.name}' completed. ${issueIds.length} issues rolled over to ${destinationSprintId ? 'target sprint' : 'backlog'}.`,
      };
    });
  }

  /**
   * Delete a sprint. Contained issues are safely unassigned to the backlog (sprintId = null)
   * through database SetNull foreign key cascades.
   */
  async remove(id: string, userId?: string) {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id },
      include: { _count: { select: { issues: true } } },
    });

    if (!sprint) {
      throw new NotFoundException(`Sprint with ID '${id}' was not found.`);
    }

    const unassignedCount = sprint._count.issues;

    await this.prisma.sprint.delete({ where: { id } });

    if (userId) {
      await this.logActivity(
        userId,
        sprint.projectId,
        'sprint_deleted',
        `deleted sprint ${sprint.name}. Unassigned ${unassignedCount} issues to backlog.`,
      );
    }

    return {
      success: true,
      id,
      unassignedIssuesCount: unassignedCount,
      message: `Sprint '${sprint.name}' deleted successfully. ${unassignedCount} issues unassigned to backlog.`,
    };
  }

  /**
   * Retrieve all issues assigned to a specific sprint.
   */
  async getSprintIssues(id: string) {
    const sprint = await this.prisma.sprint.findUnique({ where: { id } });
    if (!sprint) {
      throw new NotFoundException(`Sprint with ID '${id}' was not found.`);
    }

    return this.prisma.issue.findMany({
      where: { sprintId: id },
      include: {
        assignee: { select: { id: true, name: true, email: true, avatar: true } },
        project: { select: { id: true, key: true, name: true } },
        epic: { select: { id: true, name: true, color: true } },
      },
      orderBy: { updatedDate: 'desc' },
    });
  }

  /**
   * Calculate real-time delivery and story points progress for a sprint.
   */
  async getSprintProgress(id: string): Promise<SprintProgressMetrics> {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id },
      include: {
        issues: {
          select: { id: true, status: true, storyPoints: true },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundException(`Sprint with ID '${id}' was not found.`);
    }

    return this.computeMetrics(sprint.issues);
  }

  /**
   * Helper to compute story point aggregates and completion ratios.
   */
  private computeMetrics(
    issues: Array<{ id: string; status: IssueStatus; storyPoints: number | null }>,
  ): SprintProgressMetrics {
    const totalIssues = issues.length;
    let completedIssues = 0;
    let totalStoryPoints = 0;
    let completedStoryPoints = 0;

    for (const issue of issues) {
      const isCompleted =
        issue.status === IssueStatus.Resolved || issue.status === IssueStatus.Closed;
      const points = issue.storyPoints || 0;

      totalStoryPoints += points;
      if (isCompleted) {
        completedIssues += 1;
        completedStoryPoints += points;
      }
    }

    const openIssues = totalIssues - completedIssues;
    const remainingStoryPoints = totalStoryPoints - completedStoryPoints;

    let progressPercentage = 0;
    if (totalStoryPoints > 0) {
      progressPercentage = Math.round((completedStoryPoints / totalStoryPoints) * 100);
    } else if (totalIssues > 0) {
      progressPercentage = Math.round((completedIssues / totalIssues) * 100);
    }

    return {
      totalIssues,
      completedIssues,
      openIssues,
      totalStoryPoints,
      completedStoryPoints,
      remainingStoryPoints,
      progressPercentage,
    };
  }

  /**
   * Internal helper to record activity logs gracefully.
   */
  private async logActivity(
    userId: string,
    projectId: string,
    action: string,
    details: string,
  ) {
    try {
      const userExists = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (userExists) {
        await this.prisma.activityEvent.create({
          data: {
            userId: userExists.id,
            projectId,
            action,
            details,
          },
        });
      }
    } catch {
      // Gracefully continue without breaking main transaction
    }
  }
}
