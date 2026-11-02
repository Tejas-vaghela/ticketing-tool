const vi = jest;
import { IssuesService } from '../../backend/src/issues/issues.service';
import { PrismaService } from '../../backend/src/prisma/prisma.service';
import { IssueStatus, Priority, SupportLevel } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('IssuesService', () => {
  let service: IssuesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      issue: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      project: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      sprint: {
        findUnique: vi.fn(),
      },
      epic: {
        findUnique: vi.fn(),
      },
      activityEvent: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(prisma)),
    };

    service = new IssuesService(prisma as unknown as PrismaService);
  });

  describe('updateStatus', () => {
    const existingIssue = {
      id: 'INB-1001',
      title: 'Fix payment timeout',
      status: IssueStatus.Open,
      priority: Priority.High,
      supportLevel: SupportLevel.L1,
      responseSLAHours: 2.0,
      resolutionSLAHours: 8.0,
      firstRespondedAt: null,
      resolvedAt: null,
      reporterId: 'user-1',
      assigneeId: 'user-2',
    };

    it('should save a ticket\'s new status when given a board label (e.g. "In Progress")', async () => {
      prisma.issue.findUnique.mockResolvedValue({ ...existingIssue });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.issue.update.mockImplementation(async ({ data }: any) => ({
        ...existingIssue,
        ...data,
      }));

      const result = await service.updateStatus('INB-1001', { status: 'In Progress' as any }, 'user-1');

      expect(result.status).toBe(IssueStatus.In_Progress);
      expect(prisma.issue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'INB-1001' },
          data: expect.objectContaining({ status: IssueStatus.In_Progress }),
        }),
      );
    });

    it('should record status change in the activity log without changing SLA values', async () => {
      prisma.issue.findUnique.mockResolvedValue({ ...existingIssue });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.issue.update.mockImplementation(async ({ data }: any) => ({
        ...existingIssue,
        ...data,
      }));

      const result = await service.updateStatus('INB-1001', { status: IssueStatus.In_Progress }, 'user-1');

      // SLA values must remain exactly 2.0 and 8.0 (unchanged)
      expect(result.responseSLAHours).toBe(2.0);
      expect(result.resolutionSLAHours).toBe(8.0);

      // Verify activity event was created
      expect(prisma.activityEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          issueId: 'INB-1001',
          userId: 'user-1',
          action: 'status_changed',
        }),
      });
    });

    it('should set firstRespondedAt when moving away from Open for the first time', async () => {
      prisma.issue.findUnique.mockResolvedValue({ ...existingIssue, firstRespondedAt: null });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.issue.update.mockImplementation(async ({ data }: any) => ({
        ...existingIssue,
        ...data,
      }));

      await service.updateStatus('INB-1001', { status: IssueStatus.In_Progress }, 'user-1');

      expect(prisma.issue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: IssueStatus.In_Progress,
            firstRespondedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should set resolvedAt when moving to Resolved or Closed', async () => {
      prisma.issue.findUnique.mockResolvedValue({ ...existingIssue, status: IssueStatus.In_Progress });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.issue.update.mockImplementation(async ({ data }: any) => ({
        ...existingIssue,
        ...data,
      }));

      await service.updateStatus('INB-1001', { status: 'Resolved' as any }, 'user-1');

      expect(prisma.issue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: IssueStatus.Resolved,
            resolvedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw BadRequestException if given an invalid status', async () => {
      prisma.issue.findUnique.mockResolvedValue({ ...existingIssue });

      await expect(
        service.updateStatus('INB-1001', { status: 'non_existent_status' as any }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll filters', () => {
    it('should filter by search keyword (q or search)', async () => {
      prisma.issue.findMany.mockResolvedValue([]);
      prisma.issue.count.mockResolvedValue(0);

      await service.findAll({ search: 'payment' });

      expect(prisma.issue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { id: { contains: 'payment', mode: 'insensitive' } },
              { title: { contains: 'payment', mode: 'insensitive' } },
              { description: { contains: 'payment', mode: 'insensitive' } },
              { labels: { has: 'payment' } },
            ],
          }),
        }),
      );
    });

    it('should filter by project key or id and ignore "ALL"', async () => {
      prisma.issue.findMany.mockResolvedValue([]);
      prisma.issue.count.mockResolvedValue(0);
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-1', key: 'INB' });

      await service.findAll({ project: 'INB' });
      expect(prisma.issue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: 'proj-1' }),
        }),
      );

      // Testing 'ALL' should not set where.projectId
      prisma.issue.findMany.mockClear();
      await service.findAll({ project: 'ALL' });
      expect(prisma.issue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ projectId: expect.anything() }),
        }),
      );
    });

    it('should filter by sprint and handle BACKLOG', async () => {
      prisma.issue.findMany.mockResolvedValue([]);
      prisma.issue.count.mockResolvedValue(0);

      await service.findAll({ sprint: 'BACKLOG' });
      expect(prisma.issue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sprintId: null }),
        }),
      );

      prisma.issue.findMany.mockClear();
      await service.findAll({ sprintId: 'sprint-1' });
      expect(prisma.issue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sprintId: 'sprint-1' }),
        }),
      );
    });

    it('should filter by support tier (L1, L2, L3) and ignore "ALL"', async () => {
      prisma.issue.findMany.mockResolvedValue([]);
      prisma.issue.count.mockResolvedValue(0);

      await service.findAll({ supportTier: 'L2' });
      expect(prisma.issue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ supportLevel: SupportLevel.L2 }),
        }),
      );

      prisma.issue.findMany.mockClear();
      await service.findAll({ supportTier: 'ALL' });
      expect(prisma.issue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ supportLevel: expect.anything() }),
        }),
      );
    });

    it('should filter by assigned member (user ID, unassigned, ME) and ignore "ALL"', async () => {
      prisma.issue.findMany.mockResolvedValue([]);
      prisma.issue.count.mockResolvedValue(0);

      // Filter by ME
      await service.findAll({ assignee: 'ME' }, 'current-user-123');
      expect(prisma.issue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assigneeId: 'current-user-123' }),
        }),
      );

      // Filter by unassigned
      prisma.issue.findMany.mockClear();
      await service.findAll({ assignee: 'unassigned' });
      expect(prisma.issue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assigneeId: null }),
        }),
      );

      // Filter by specific user
      prisma.issue.findMany.mockClear();
      await service.findAll({ assignee: 'user-456' });
      expect(prisma.issue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assigneeId: 'user-456' }),
        }),
      );
    });
  });
});
