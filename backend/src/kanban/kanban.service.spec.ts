import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KanbanService, KANBAN_COLUMNS } from './kanban.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { IssueStatus, Priority, SupportLevel } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('KanbanService', () => {
  let service: KanbanService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      issue: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      project: {
        findFirst: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      sprint: {
        findUnique: vi.fn(),
      },
      activityEvent: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(prisma)),
    };

    service = new KanbanService(prisma as unknown as PrismaService);
  });

  describe('getColumns', () => {
    it('should return predefined workflow columns matching Kanban requirements', () => {
      const columns = service.getColumns();
      expect(columns).toEqual(KANBAN_COLUMNS);
      expect(columns.map(c => c.id)).toEqual([
        'To Do',
        'In Progress',
        'In Review',
        'Testing',
        'Resolved',
        'Closed',
      ]);
    });
  });

  describe('getBoard', () => {
    it('should fetch issues and group them by Kanban column', async () => {
      const mockIssues = [
        { id: 'INB-1001', title: 'Task 1', status: IssueStatus.To_Do, storyPoints: 3 },
        { id: 'INB-1002', title: 'Task 2', status: IssueStatus.In_Progress, storyPoints: 5 },
      ];
      prisma.issue.findMany.mockResolvedValue(mockIssues);
      prisma.issue.count.mockResolvedValue(2);

      const board = await service.getBoard({});

      expect(board.totalCount).toBe(2);
      expect(board.issues).toHaveLength(2);
      expect(board.groupedIssues['To Do']).toHaveLength(1);
      expect(board.groupedIssues['In Progress']).toHaveLength(1);
      expect(board.groupedIssues['Resolved']).toHaveLength(0);
    });

    it('should filter board by project, sprint, search, and assignee', async () => {
      prisma.issue.findMany.mockResolvedValue([]);
      prisma.issue.count.mockResolvedValue(0);
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-1', key: 'INB' });

      await service.getBoard({
        project: 'INB',
        sprint: 'BACKLOG',
        search: 'auth',
        assignee: 'ME',
      }, 'user-123');

      expect(prisma.issue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'proj-1',
            sprintId: null,
            assigneeId: 'user-123',
            OR: expect.arrayContaining([
              expect.objectContaining({ title: { contains: 'auth', mode: 'insensitive' } }),
            ]),
          }),
        }),
      );
    });
  });

  describe('updateStatus', () => {
    const existingIssue = {
      id: 'INB-1001',
      title: 'Kanban Issue',
      status: IssueStatus.To_Do,
      priority: Priority.High,
      supportLevel: SupportLevel.L1,
      responseSLAHours: 2.0,
      resolutionSLAHours: 8.0,
      firstRespondedAt: null,
      resolvedAt: null,
      reporterId: 'user-1',
      assigneeId: 'user-2',
    };

    it('should save new status to PostgreSQL when given board label "In Progress"', async () => {
      prisma.issue.findUnique.mockResolvedValue({ ...existingIssue });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.issue.update.mockImplementation(async ({ data }: any) => ({
        ...existingIssue,
        ...data,
      }));

      const updated = await service.updateStatus('INB-1001', { status: 'In Progress' as any }, 'user-1');

      expect(updated.status).toBe(IssueStatus.In_Progress);
      expect(prisma.issue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'INB-1001' },
          data: expect.objectContaining({ status: IssueStatus.In_Progress }),
        }),
      );
      expect(prisma.activityEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          issueId: 'INB-1001',
          action: 'status_changed',
        }),
      });
    });

    it('should reject invalid status with BadRequestException', async () => {
      prisma.issue.findUnique.mockResolvedValue({ ...existingIssue });

      await expect(
        service.updateStatus('INB-1001', { status: 'INVALID_STATUS' as any }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
