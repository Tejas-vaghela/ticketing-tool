import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectStatus, IssueStatus, Prisma } from '@prisma/client';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';

export interface SafeUserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
}

export interface ProjectListItem {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string | null;
  leadId: string;
  lead?: SafeUserSummary;
  members?: SafeUserSummary[];
  memberIds: string[];
  status: ProjectStatus;
  createdDate: Date;
  updatedDate: Date;
  _count: {
    issues: number;
    sprints: number;
    epics: number;
  };
  activeIssueCount: number;
}

export interface ProjectDetailItem {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string | null;
  leadId: string;
  lead?: SafeUserSummary;
  members: SafeUserSummary[];
  memberIds: string[];
  status: ProjectStatus;
  createdDate: Date;
  updatedDate: Date;
  sprints: any[];
  epics: any[];
  metrics: {
    totalIssues: number;
    openIssues: number;
    inProgressIssues: number;
    resolvedIssues: number;
  };
}

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatar: true,
} as const;

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // --------------------------------------------------------------------------
  // GET /api/projects
  // List projects with optional filtering, searching, and pagination.
  // --------------------------------------------------------------------------
  async findAll(query: QueryProjectsDto): Promise<ProjectListItem[]> {
    const where: Prisma.ProjectWhereInput = {};

    if (query.q) {
      const q = query.q.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { key: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.category) {
      where.category = { equals: query.category.trim(), mode: 'insensitive' };
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const projects = await this.prisma.project.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdDate: 'desc' },
      include: {
        lead: { select: safeUserSelect },
        members: { select: safeUserSelect },
        _count: {
          select: {
            issues: true,
            sprints: true,
            epics: true,
          },
        },
      },
    });

    if (projects.length === 0) {
      return [];
    }

    // Group active issues count by projectId
    const projectIds = projects.map(p => p.id);
    const activeCounts = await this.prisma.issue.groupBy({
      by: ['projectId'],
      where: {
        projectId: { in: projectIds },
        status: { notIn: [IssueStatus.Resolved, IssueStatus.Closed] },
      },
      _count: { _all: true },
    });

    const activeMap = new Map(activeCounts.map(ac => [ac.projectId, ac._count._all]));

    return projects.map(p => ({
      id: p.id,
      key: p.key,
      name: p.name,
      description: p.description,
      category: p.category,
      leadId: p.leadId,
      lead: p.lead,
      members: p.members,
      memberIds: p.members.map(m => m.id),
      status: p.status,
      createdDate: p.createdDate,
      updatedDate: p.updatedDate,
      _count: p._count,
      activeIssueCount: activeMap.get(p.id) ?? 0,
    }));
  }

  // --------------------------------------------------------------------------
  // GET /api/projects/:idOrKey
  // Retrieve a single project cockpit by CUID or Key.
  // --------------------------------------------------------------------------
  async findOne(identifier: string): Promise<ProjectDetailItem> {
    const trimmed = identifier.trim();

    const project = await this.prisma.project.findFirst({
      where: {
        OR: [
          { id: trimmed },
          { key: trimmed.toUpperCase() },
        ],
      },
      include: {
        lead: { select: safeUserSelect },
        members: { select: safeUserSelect },
        sprints: { orderBy: { startDate: 'desc' } },
        epics: { orderBy: { createdAt: 'desc' } },
        _count: {
          select: {
            issues: true,
            sprints: true,
            epics: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with identifier ${identifier} not found.`);
    }

    // Compute Cockpit telemetry metrics
    const [totalIssues, openIssues, inProgressIssues, resolvedIssues] = await Promise.all([
      this.prisma.issue.count({ where: { projectId: project.id } }),
      this.prisma.issue.count({
        where: {
          projectId: project.id,
          status: { in: [IssueStatus.Open, IssueStatus.To_Do] },
        },
      }),
      this.prisma.issue.count({
        where: {
          projectId: project.id,
          status: { in: [IssueStatus.In_Progress, IssueStatus.In_Review, IssueStatus.Testing] },
        },
      }),
      this.prisma.issue.count({
        where: {
          projectId: project.id,
          status: { in: [IssueStatus.Resolved, IssueStatus.Closed] },
        },
      }),
    ]);

    return {
      id: project.id,
      key: project.key,
      name: project.name,
      description: project.description,
      category: project.category,
      leadId: project.leadId,
      lead: project.lead,
      members: project.members,
      memberIds: project.members.map(m => m.id),
      status: project.status,
      createdDate: project.createdDate,
      updatedDate: project.updatedDate,
      sprints: project.sprints,
      epics: project.epics,
      metrics: {
        totalIssues,
        openIssues,
        inProgressIssues,
        resolvedIssues,
      },
    };
  }

  // --------------------------------------------------------------------------
  // POST /api/projects
  // Create a new project repository.
  // --------------------------------------------------------------------------
  async create(dto: CreateProjectDto): Promise<any> {
    const key = dto.key.trim().toUpperCase();

    // Check unique key constraint
    const existingKey = await this.prisma.project.findUnique({
      where: { key },
    });
    if (existingKey) {
      throw new ConflictException(`Unique constraint violation on key. A record with this value already exists.`);
    }

    // Verify lead user exists
    const leadUser = await this.prisma.user.findUnique({
      where: { id: dto.leadId },
    });
    if (!leadUser) {
      throw new BadRequestException(`User with ID ${dto.leadId} does not exist and cannot be assigned as Project Lead.`);
    }

    // Ensure leadId is included in members
    const memberIdSet = new Set(dto.memberIds || []);
    memberIdSet.add(dto.leadId);
    const memberIds = Array.from(memberIdSet);

    // Verify all member IDs exist
    const validMembers = await this.prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true },
    });
    const validMemberIds = validMembers.map(vm => vm.id);

    const created = await this.prisma.project.create({
      data: {
        key,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? '',
        category: dto.category?.trim() ?? 'Software',
        leadId: dto.leadId,
        status: dto.status ?? ProjectStatus.Active,
        members: {
          connect: validMemberIds.map(id => ({ id })),
        },
      },
      include: {
        lead: { select: safeUserSelect },
        members: { select: safeUserSelect },
      },
    });

    this.logger.log(`Project ${created.key} created successfully (ID: ${created.id}).`);

    return {
      id: created.id,
      key: created.key,
      name: created.name,
      description: created.description,
      category: created.category,
      leadId: created.leadId,
      lead: created.lead,
      members: created.members,
      memberIds: created.members.map(m => m.id),
      status: created.status,
      createdDate: created.createdDate,
      updatedDate: created.updatedDate,
    };
  }

  // --------------------------------------------------------------------------
  // PATCH /api/projects/:id
  // Update project metadata and member assignments.
  // --------------------------------------------------------------------------
  async update(id: string, dto: UpdateProjectDto): Promise<any> {
    const existing = await this.prisma.project.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!existing) {
      throw new NotFoundException(`Project with identifier ${id} not found.`);
    }

    // If updating leadId, ensure target user exists
    if (dto.leadId) {
      const leadUser = await this.prisma.user.findUnique({
        where: { id: dto.leadId },
      });
      if (!leadUser) {
        throw new BadRequestException(`User with ID ${dto.leadId} does not exist and cannot be assigned as Project Lead.`);
      }
    }

    const updateData: Prisma.ProjectUpdateInput = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      updateData.description = dto.description.trim();
    }
    if (dto.category !== undefined) {
      updateData.category = dto.category.trim();
    }
    if (dto.status !== undefined) {
      updateData.status = dto.status;
    }
    if (dto.leadId !== undefined) {
      updateData.lead = { connect: { id: dto.leadId } };
    }

    if (dto.memberIds !== undefined) {
      const targetLeadId = dto.leadId || existing.leadId;
      const memberIdSet = new Set(dto.memberIds);
      memberIdSet.add(targetLeadId);

      const validMembers = await this.prisma.user.findMany({
        where: { id: { in: Array.from(memberIdSet) } },
        select: { id: true },
      });

      updateData.members = {
        set: validMembers.map(vm => ({ id: vm.id })),
      };
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        lead: { select: safeUserSelect },
        members: { select: safeUserSelect },
      },
    });

    this.logger.log(`Project ${updated.key} updated successfully.`);

    return {
      id: updated.id,
      key: updated.key,
      name: updated.name,
      description: updated.description,
      category: updated.category,
      leadId: updated.leadId,
      lead: updated.lead,
      members: updated.members,
      memberIds: updated.members.map(m => m.id),
      status: updated.status,
      createdDate: updated.createdDate,
      updatedDate: updated.updatedDate,
    };
  }

  // --------------------------------------------------------------------------
  // DELETE /api/projects/:id
  // Permanently delete a project and cascade child data.
  // --------------------------------------------------------------------------
  async remove(id: string): Promise<{ message: string }> {
    const project = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException(`Project with identifier ${id} not found.`);
    }

    await this.prisma.project.delete({
      where: { id },
    });

    this.logger.log(`Project ${project.key} (${project.id}) permanently deleted.`);

    return {
      message: `Project ${project.key} and all associated tickets have been permanently deleted.`,
    };
  }
}
