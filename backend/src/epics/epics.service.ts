import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateEpicDto } from './dto/create-epic.dto.js';
import { UpdateEpicDto } from './dto/update-epic.dto.js';
import { QueryEpicsDto } from './dto/query-epics.dto.js';
import { EpicStatus, IssueStatus } from '@prisma/client';

export interface EpicProgressMetrics {
  totalIssues: number;
  completedIssues: number;
  inProgressIssues: number;
  todoIssues: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  remainingStoryPoints: number;
  progressPercentage: number;
}

@Injectable()
export class EpicsService {
  constructor(private readonly prisma: PrismaService) {}

  private parseDueDate(value: string): Date {
    const dueDate = new Date(value);
    if (isNaN(dueDate.getTime())) {
      throw new BadRequestException('Invalid dueDate provided.');
    }

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (value.slice(0, 10) < today) {
      throw new BadRequestException('Target due date must be today or a future date.');
    }

    return dueDate;
  }

  /**
   * Create a new Epic within a specified Project.
   */
  async create(dto: CreateEpicDto, userId?: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        OR: [{ id: dto.projectId }, { key: dto.projectId }],
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID or key '${dto.projectId}' was not found.`);
    }

    let dueDate: Date | null = null;
    if (dto.dueDate) {
      dueDate = this.parseDueDate(dto.dueDate);
    }

    // IDs are global primary keys, so find the next number across all projects.
    // Retry a unique-key collision in case two Epics are created at once.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existingEpics = await this.prisma.epic.findMany({
        select: { id: true },
      });
      const highestNumber = existingEpics.reduce((highest, epic) => {
        const match = /^epic-(\d+)$/i.exec(epic.id);
        return match ? Math.max(highest, Number(match[1])) : highest;
      }, 0);
      const id = `epic-${highestNumber + 1}`;

      try {
        return await this.prisma.epic.create({
          data: {
            id,
            projectId: project.id,
            name: dto.name.trim(),
            description: dto.description?.trim() ?? '',
            summary: dto.summary?.trim() || null,
            color: dto.color ?? '#3b82f6',
            status: dto.status ?? EpicStatus.To_Do,
            dueDate,
          },
          include: {
            project: { select: { id: true, key: true, name: true } },
            _count: { select: { issues: true } },
          },
        });
      } catch (error) {
        const isIdCollision =
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'P2002';
        if (!isIdCollision || attempt === 4) {
          throw error;
        }
      }
    }

    throw new Error('Could not generate a unique Epic ID. Please try again.');
  }

  /**
   * Retrieve list of Epics matching filters, keyword search, and pagination.
   * Enriches each record with calculated progress metrics.
   */
  async findAll(query: QueryEpicsDto) {
    const where: any = {};

    const targetProject = query.projectId || query.project;
    if (targetProject) {
      const project = await this.prisma.project.findFirst({
        where: {
          OR: [{ id: targetProject }, { key: targetProject }],
        },
      });
      if (project) {
        where.projectId = project.id;
      } else {
        where.projectId = targetProject; // Will yield empty result if invalid
      }
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { summary: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 50;

    const [epics, totalCount] = await Promise.all([
      this.prisma.epic.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          project: { select: { id: true, key: true, name: true } },
          issues: {
            select: {
              id: true,
              status: true,
              storyPoints: true,
            },
          },
        },
      }),
      this.prisma.epic.count({ where }),
    ]);

    return epics.map((epic) => {
      const metrics = this.computeMetrics(epic.issues);
      const { issues, ...rest } = epic;
      return {
        ...rest,
        metrics,
      };
    });
  }

  /**
   * Retrieve single Epic details with all contained issues and calculated rollup metrics.
   */
  async findOne(id: string) {
    const epic = await this.prisma.epic.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, key: true, name: true } },
        issues: {
          orderBy: { updatedDate: 'desc' },
          include: {
            assignee: { select: { id: true, name: true, email: true, avatar: true } },
            sprint: { select: { id: true, name: true, status: true } },
          },
        },
      },
    });

    if (!epic) {
      throw new NotFoundException(`Epic with ID '${id}' was not found.`);
    }

    const metrics = this.computeMetrics(epic.issues);
    return {
      ...epic,
      metrics,
    };
  }

  /**
   * Retrieve epics by Project ID or Project Key.
   */
  async findByProject(projectIdOrKey: string) {
    return this.findAll({ projectId: projectIdOrKey });
  }

  /**
   * Update mutable fields of an Epic.
   */
  async update(id: string, dto: UpdateEpicDto, userId?: string) {
    const existing = await this.prisma.epic.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Epic with ID '${id}' was not found.`);
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description.trim();
    if (dto.summary !== undefined) data.summary = dto.summary.trim() || null;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.status !== undefined) data.status = dto.status;

    if (dto.dueDate !== undefined) {
      if (dto.dueDate) {
        data.dueDate = this.parseDueDate(dto.dueDate);
      } else {
        data.dueDate = null;
      }
    }

    return this.prisma.epic.update({
      where: { id },
      data,
      include: {
        project: { select: { id: true, key: true, name: true } },
        _count: { select: { issues: true } },
      },
    });
  }

  /**
   * Delete an Epic. Linked issues have their epicId set to null (onDelete: SetNull).
   */
  async remove(id: string, userId?: string) {
    const existing = await this.prisma.epic.findUnique({
      where: { id },
      include: { _count: { select: { issues: true } } },
    });

    if (!existing) {
      throw new NotFoundException(`Epic with ID '${id}' was not found.`);
    }

    await this.prisma.epic.delete({ where: { id } });

    return {
      success: true,
      message: `Epic '${existing.name}' (${id}) was deleted. ${existing._count.issues} associated issues unlinked.`,
    };
  }

  /**
   * Retrieve all issues assigned to a specific epic.
   */
  async getEpicIssues(id: string) {
    const existing = await this.prisma.epic.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Epic with ID '${id}' was not found.`);
    }

    return this.prisma.issue.findMany({
      where: { epicId: id },
      orderBy: { createdDate: 'desc' },
      include: {
        assignee: { select: { id: true, name: true, email: true, avatar: true } },
        sprint: { select: { id: true, name: true, status: true } },
        project: { select: { id: true, key: true, name: true } },
      },
    });
  }

  /**
   * Assign an existing Issue to an Epic.
   */
  async assignIssue(epicId: string, issueId: string, userId?: string) {
    const [epic, issue] = await Promise.all([
      this.prisma.epic.findUnique({ where: { id: epicId } }),
      this.prisma.issue.findUnique({ where: { id: issueId } }),
    ]);

    if (!epic) {
      throw new NotFoundException(`Epic with ID '${epicId}' was not found.`);
    }
    if (!issue) {
      throw new NotFoundException(`Issue with ID '${issueId}' was not found.`);
    }

    return this.prisma.issue.update({
      where: { id: issueId },
      data: {
        epic: { connect: { id: epicId } },
      },
      include: {
        epic: { select: { id: true, name: true, color: true } },
        project: { select: { id: true, key: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Remove an Issue from an Epic.
   */
  async removeIssue(epicId: string, issueId: string, userId?: string) {
    const issue = await this.prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) {
      throw new NotFoundException(`Issue with ID '${issueId}' was not found.`);
    }

    if (issue.epicId !== epicId) {
      throw new BadRequestException(`Issue '${issueId}' is not assigned to Epic '${epicId}'.`);
    }

    return this.prisma.issue.update({
      where: { id: issueId },
      data: {
        epic: { disconnect: true },
      },
      include: {
        project: { select: { id: true, key: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Helper: Computes virtual delivery and story point progress metrics from issues.
   */
  private computeMetrics(
    issues: Array<{ status: IssueStatus; storyPoints?: number | null }>,
  ): EpicProgressMetrics {
    const totalIssues = issues.length;
    let completedIssues = 0;
    let inProgressIssues = 0;
    let todoIssues = 0;
    let totalStoryPoints = 0;
    let completedStoryPoints = 0;

    for (const issue of issues) {
      const sp = issue.storyPoints || 0;
      totalStoryPoints += sp;

      if (issue.status === IssueStatus.Resolved || issue.status === IssueStatus.Closed) {
        completedIssues++;
        completedStoryPoints += sp;
      } else if (
        issue.status === IssueStatus.In_Progress ||
        issue.status === IssueStatus.In_Review ||
        issue.status === IssueStatus.Testing
      ) {
        inProgressIssues++;
      } else {
        todoIssues++;
      }
    }

    const remainingStoryPoints = Math.max(0, totalStoryPoints - completedStoryPoints);
    const progressPercentage =
      totalIssues === 0 ? 0 : Math.round((completedIssues / totalIssues) * 100);

    return {
      totalIssues,
      completedIssues,
      inProgressIssues,
      todoIssues,
      totalStoryPoints,
      completedStoryPoints,
      remainingStoryPoints,
      progressPercentage,
    };
  }
}
