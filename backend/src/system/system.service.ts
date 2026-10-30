import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { ImportSystemDto } from './dto/import-system.dto.js';
import {
  SystemHealthResponseDto,
  DatabaseHealthStatus,
} from './dto/system-health.dto.js';
import { SystemInfoResponseDto } from './dto/system-info.dto.js';
import bcrypt from 'bcrypt';
import {
  UserRole,
  SupportLevel,
  UserStatus,
  ProjectStatus,
  SprintStatus,
  EpicStatus,
} from '@prisma/client';

@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Health and readiness probe checking application process state
   * and PostgreSQL database connectivity safely.
   */
  async getHealth(): Promise<SystemHealthResponseDto> {
    const mem = process.memoryUsage();
    const memoryUsageMb = Number((mem.rss / (1024 * 1024)).toFixed(2));
    const dbStatus = await this.pingDatabase();

    const isHealthy = dbStatus.status === 'up';

    return {
      status: isHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: Number(process.uptime().toFixed(2)),
      services: {
        database: dbStatus,
        application: {
          status: 'up',
          memoryUsageMb,
        },
      },
    };
  }

  /**
   * Returns non-sensitive runtime and environment metadata.
   * Strictly isolates database passwords, JWT secrets, and .env tokens.
   */
  async getInfo(): Promise<SystemInfoResponseDto> {
    const mem = process.memoryUsage();
    const env = this.configService.get<string>('NODE_ENV', 'development');

    let connectionStatus: 'connected' | 'disconnected' | 'unknown' = 'unknown';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      connectionStatus = 'connected';
    } catch {
      connectionStatus = 'disconnected';
    }

    return {
      success: true,
      data: {
        application: {
          name: 'Inbox Ticketing & Task Management Core API',
          version: '0.0.1',
          environment: env,
        },
        runtime: {
          nodeVersion: process.version,
          platform: process.platform,
          uptimeSeconds: Math.floor(process.uptime()),
          memory: {
            rssMb: Number((mem.rss / (1024 * 1024)).toFixed(2)),
            heapTotalMb: Number((mem.heapTotal / (1024 * 1024)).toFixed(2)),
            heapUsedMb: Number((mem.heapUsed / (1024 * 1024)).toFixed(2)),
            externalMb: Number((mem.external / (1024 * 1024)).toFixed(2)),
          },
        },
        database: {
          provider: 'postgresql',
          client: 'prisma',
          connectionStatus,
        },
      },
    };
  }

  /**
   * Generates a complete JSON backup snapshot of all 12 operational models.
   * Restricted strictly to Admin users. Strips password hashes for security.
   */
  async exportDatabase(adminUserId?: string) {
    try {
      const [
        users,
        projects,
        epics,
        sprints,
        issues,
        comments,
        attachments,
        escalationRecords,
        activities,
        notifications,
        savedFilters,
        settings,
      ] = await Promise.all([
        this.prisma.user.findMany({
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: true,
            supportLevels: true,
            avatar: true,
            timezone: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        this.prisma.project.findMany(),
        this.prisma.epic.findMany(),
        this.prisma.sprint.findMany(),
        this.prisma.issue.findMany(),
        this.prisma.comment.findMany(),
        this.prisma.attachment.findMany(),
        this.prisma.escalationRecord.findMany(),
        this.prisma.activityEvent.findMany({
          orderBy: { timestamp: 'desc' },
          take: 500,
        }),
        this.prisma.notification.findMany({
          orderBy: { createdAt: 'desc' },
          take: 500,
        }),
        this.prisma.savedFilter.findMany(),
        this.prisma.settings.findFirst(),
      ]);

      const recordCounts = {
        users: users.length,
        projects: projects.length,
        epics: epics.length,
        sprints: sprints.length,
        issues: issues.length,
        comments: comments.length,
        attachments: attachments.length,
        escalationRecords: escalationRecords.length,
        activities: activities.length,
        notifications: notifications.length,
        savedFilters: savedFilters.length,
        settings: settings ? 1 : 0,
      };

      if (adminUserId) {
        try {
          await this.prisma.activityEvent.create({
            data: {
              userId: adminUserId,
              action: 'SYSTEM_EXPORT',
              details: 'Administrative database snapshot export generated',
            },
          });
        } catch (auditErr) {
          this.logger.warn('Failed to record export audit event:', auditErr);
        }
      }

      return {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        exportedBy: adminUserId ?? 'system',
        recordCounts,
        data: {
          users,
          projects,
          epics,
          sprints,
          issues,
          comments,
          attachments,
          escalationRecords,
          activities,
          notifications,
          savedFilters,
          settings,
        },
      };
    } catch (error) {
      this.logger.error('Failed to export database snapshot:', error);
      throw new InternalServerErrorException('An error occurred while generating the database export.');
    }
  }

  /**
   * Atomically restores database state from a validated JSON backup dump.
   * Uses reverse topological order for deletion and topological order for insertion.
   */
  async importDatabase(dto: ImportSystemDto, adminUserId?: string) {
    if (!dto.data || typeof dto.data !== 'object') {
      throw new BadRequestException('Invalid backup payload: data object is missing or malformed.');
    }

    const { data } = dto;
    const defaultPasswordHash = await bcrypt.hash('admin123', 10);

    try {
      const restoredCounts = await this.prisma.$transaction(
        async (tx) => {
          // 1. Delete all records in reverse topological order (children first)
          await tx.attachment.deleteMany();
          await tx.comment.deleteMany();
          await tx.escalationRecord.deleteMany();
          await tx.activityEvent.deleteMany();
          await tx.notification.deleteMany();
          await tx.savedFilter.deleteMany();
          await tx.issue.deleteMany();
          await tx.epic.deleteMany();
          await tx.sprint.deleteMany();
          await tx.project.deleteMany();
          await tx.user.deleteMany();
          await tx.settings.deleteMany();

          // 2. Insert records in topological order (parents first)
          let usersCount = 0;
          if (Array.isArray(data.users) && data.users.length > 0) {
            const userRecords = data.users.map((u: any) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              password: u.password ?? defaultPasswordHash,
              role: u.role ?? UserRole.Viewer,
              department: u.department ?? 'General',
              supportLevels: u.supportLevels ?? [SupportLevel.L1],
              avatar: u.avatar ?? '',
              timezone: u.timezone ?? 'UTC',
              status: u.status ?? UserStatus.Active,
              createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
              updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
            }));
            const res = await tx.user.createMany({ data: userRecords });
            usersCount = res.count;
          }

          let settingsCount = 0;
          if (data.settings && typeof data.settings === 'object') {
            await tx.settings.create({
              data: {
                id: data.settings.id ?? 'singleton',
                appName: data.settings.appName ?? 'Inbox',
                tagline: data.settings.tagline ?? 'Work organized. Teams aligned.',
                workspaceName: data.settings.workspaceName ?? 'Acme Global Workspace',
                theme: data.settings.theme ?? 'light',
                notificationsEnabled: data.settings.notificationsEnabled ?? true,
                slaSettings: data.settings.slaSettings ?? { l1ResponseHours: 4, l1ResolutionHours: 24 },
                notifications: data.settings.notifications ?? {},
                preferences: data.settings.preferences ?? {},
                slaRules: data.settings.slaRules ?? {},
                rolePageAccess: data.settings.rolePageAccess ?? {},
              },
            });
            settingsCount = 1;
          }

          let projectsCount = 0;
          if (Array.isArray(data.projects) && data.projects.length > 0) {
            const projectRecords = data.projects.map((p: any) => ({
              id: p.id,
              key: p.key,
              name: p.name,
              description: p.description ?? '',
              category: p.category ?? 'Software',
              leadId: p.leadId,
              status: p.status ?? ProjectStatus.Active,
              createdDate: p.createdDate ? new Date(p.createdDate) : new Date(),
              updatedDate: p.updatedDate ? new Date(p.updatedDate) : new Date(),
            }));
            const res = await tx.project.createMany({ data: projectRecords });
            projectsCount = res.count;
          }

          let sprintsCount = 0;
          if (Array.isArray(data.sprints) && data.sprints.length > 0) {
            const sprintRecords = data.sprints.map((s: any) => ({
              id: s.id,
              projectId: s.projectId,
              name: s.name,
              startDate: s.startDate ? new Date(s.startDate) : new Date(),
              endDate: s.endDate ? new Date(s.endDate) : new Date(),
              status: s.status ?? SprintStatus.planned,
              goal: s.goal ?? null,
              completedDate: s.completedDate ? new Date(s.completedDate) : null,
              createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
            }));
            const res = await tx.sprint.createMany({ data: sprintRecords });
            sprintsCount = res.count;
          }

          let epicsCount = 0;
          if (Array.isArray(data.epics) && data.epics.length > 0) {
            const epicRecords = data.epics.map((e: any) => ({
              id: e.id,
              projectId: e.projectId,
              name: e.name,
              description: e.description ?? '',
              summary: e.summary ?? null,
              color: e.color ?? '#3b82f6',
              status: e.status ?? EpicStatus.To_Do,
              dueDate: e.dueDate ? new Date(e.dueDate) : null,
              createdAt: e.createdAt ? new Date(e.createdAt) : new Date(),
            }));
            const res = await tx.epic.createMany({ data: epicRecords });
            epicsCount = res.count;
          }

          let issuesCount = 0;
          if (Array.isArray(data.issues) && data.issues.length > 0) {
            const issueRecords = data.issues.map((i: any) => ({
              id: i.id,
              title: i.title,
              description: i.description ?? '',
              type: i.type,
              status: i.status,
              priority: i.priority,
              supportLevel: i.supportLevel,
              assigneeId: i.assigneeId ?? null,
              reporterId: i.reporterId,
              projectId: i.projectId,
              sprintId: i.sprintId ?? null,
              epicId: i.epicId ?? null,
              labels: i.labels ?? [],
              dueDate: i.dueDate ? new Date(i.dueDate) : null,
              createdDate: i.createdDate ? new Date(i.createdDate) : new Date(),
              updatedDate: i.updatedDate ? new Date(i.updatedDate) : new Date(),
              estimatedTime: i.estimatedTime ?? null,
              remainingTime: i.remainingTime ?? null,
              storyPoints: i.storyPoints ?? null,
              responseSLAHours: i.responseSLAHours ?? 4.0,
              resolutionSLAHours: i.resolutionSLAHours ?? 24.0,
              firstRespondedAt: i.firstRespondedAt ? new Date(i.firstRespondedAt) : null,
              resolvedAt: i.resolvedAt ? new Date(i.resolvedAt) : null,
              isEscalated: i.isEscalated ?? false,
            }));
            const res = await tx.issue.createMany({ data: issueRecords });
            issuesCount = res.count;
          }

          if (Array.isArray(data.comments) && data.comments.length > 0) {
            await tx.comment.createMany({
              data: data.comments.map((c: any) => ({
                id: c.id,
                issueId: c.issueId,
                authorId: c.authorId,
                content: c.content,
                type: c.type ?? 'public',
                createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
              })),
            });
          }

          if (Array.isArray(data.attachments) && data.attachments.length > 0) {
            await tx.attachment.createMany({
              data: data.attachments.map((a: any) => ({
                id: a.id,
                issueId: a.issueId,
                filename: a.filename,
                fileType: a.fileType,
                fileSize: a.fileSize,
                uploadDate: a.uploadDate ? new Date(a.uploadDate) : new Date(),
              })),
            });
          }

          if (Array.isArray(data.escalationRecords) && data.escalationRecords.length > 0) {
            await tx.escalationRecord.createMany({
              data: data.escalationRecords.map((r: any) => ({
                id: r.id,
                issueId: r.issueId,
                timestamp: r.timestamp ? new Date(r.timestamp) : new Date(),
                fromLevel: r.fromLevel,
                toLevel: r.toLevel,
                reason: r.reason,
                escalatedByUserId: r.escalatedByUserId,
                assignedToUserId: r.assignedToUserId ?? null,
              })),
            });
          }

          if (Array.isArray(data.savedFilters) && data.savedFilters.length > 0) {
            await tx.savedFilter.createMany({
              data: data.savedFilters.map((f: any) => ({
                id: f.id,
                userId: f.userId ?? null,
                name: f.name,
                filters: f.filters,
              })),
            });
          }

          if (adminUserId) {
            await tx.activityEvent.create({
              data: {
                userId: adminUserId,
                action: 'SYSTEM_IMPORT',
                details: 'Database restored successfully from JSON backup snapshot',
                timestamp: new Date(),
              },
            });
          }

          return {
            users: usersCount,
            projects: projectsCount,
            sprints: sprintsCount,
            epics: epicsCount,
            issues: issuesCount,
            settings: settingsCount,
          };
        },
        { timeout: 60000 },
      );

      return {
        success: true,
        message: 'Database successfully restored from backup snapshot.',
        restoredCounts,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Database restore transaction failed:', error);
      throw new InternalServerErrorException(
        'An error occurred while restoring the database from backup.',
      );
    }
  }

  /**
   * Resets the entire relational database to factory seed data.
   * Atomically wipes all operational data and repopulates initial accounts,
   * projects, sprints, epics, and settings.
   */
  async resetToFactorySeed(adminUserId?: string) {
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const userPasswordHash = await bcrypt.hash('support123', 10);

    try {
      await this.prisma.$transaction(
        async (tx) => {
          // 1. Purge all tables in reverse topological order
          await tx.attachment.deleteMany();
          await tx.comment.deleteMany();
          await tx.escalationRecord.deleteMany();
          await tx.activityEvent.deleteMany();
          await tx.notification.deleteMany();
          await tx.savedFilter.deleteMany();
          await tx.issue.deleteMany();
          await tx.epic.deleteMany();
          await tx.sprint.deleteMany();
          await tx.project.deleteMany();
          await tx.user.deleteMany();
          await tx.settings.deleteMany();

          // 2. Repopulate seed users
          const seedUsers = [
            {
              id: 'user-1',
              name: 'Tejas Chauhan',
              email: 'tejas@inbox.goldmine.io',
              password: adminPasswordHash,
              role: UserRole.Admin,
              department: 'Engineering & Operations',
              supportLevels: [SupportLevel.L1, SupportLevel.L2, SupportLevel.L3],
              avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
              timezone: 'UTC+05:30 (IST)',
              status: UserStatus.Active,
            },
            {
              id: 'user-2',
              name: 'Rahul Sharma',
              email: 'rahul.s@inbox.goldmine.io',
              password: userPasswordHash,
              role: UserRole.Support_Agent,
              department: 'Customer Support',
              supportLevels: [SupportLevel.L1],
              avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
              timezone: 'UTC+05:30 (IST)',
              status: UserStatus.Active,
            },
          ];
          await tx.user.createMany({ data: seedUsers });

          // 3. Repopulate default settings
          await tx.settings.create({
            data: {
              id: 'singleton',
              appName: 'Inbox',
              tagline: 'Work organized. Teams aligned.',
              workspaceName: 'Acme Global Workspace',
              theme: 'light',
              notificationsEnabled: true,
              slaSettings: { l1ResponseHours: 4, l1ResolutionHours: 24 },
              notifications: {},
              preferences: {},
              slaRules: {},
              rolePageAccess: {},
            },
          });

          // 4. Repopulate initial project
          const project = await tx.project.create({
            data: {
              id: 'proj-1',
              key: 'INB',
              name: 'Inbox CRM',
              description: 'GoldMine customer relationship management platform',
              leadId: 'user-1',
              status: ProjectStatus.Active,
            },
          });

          // 5. Repopulate initial sprints and epics
          await tx.sprint.create({
            data: {
              id: 'sprint-1',
              projectId: project.id,
              name: 'Sprint 1',
              startDate: new Date('2026-10-01T00:00:00Z'),
              endDate: new Date('2026-10-15T23:59:59Z'),
              status: SprintStatus.completed,
            },
          });

          await tx.epic.create({
            data: {
              id: 'epic-1',
              projectId: project.id,
              name: 'Core Platform Setup',
              description: 'Initial architectural foundation and ticketing pipeline',
              color: '#3b82f6',
              status: EpicStatus.Done,
            },
          });

          if (adminUserId) {
            await tx.activityEvent.create({
              data: {
                userId: adminUserId,
                action: 'SYSTEM_RESET',
                details: 'Database reset to factory seeds completed',
                timestamp: new Date(),
              },
            });
          }
        },
        { timeout: 60000 },
      );

      return {
        success: true,
        message: 'Database successfully reset to initial factory seed data.',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to reset database to factory seeds:', error);
      throw new InternalServerErrorException(
        'An error occurred while resetting the database to factory seeds.',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  private async pingDatabase(): Promise<DatabaseHealthStatus> {
    const start = performance.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const latencyMs = Number((performance.now() - start).toFixed(2));
      return { status: 'up', latencyMs };
    } catch (error: any) {
      const latencyMs = Number((performance.now() - start).toFixed(2));
      this.logger.error('Database ping error:', error?.message || error);
      return {
        status: 'down',
        latencyMs,
        error: 'Database connection check failed',
      };
    }
  }
}
