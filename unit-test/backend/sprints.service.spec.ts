const vi = jest;
import { Test, TestingModule } from '@nestjs/testing';
import { SprintsService } from '../../backend/src/sprints/sprints.service';
import { PrismaService } from '../../backend/src/prisma/prisma.service';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { SprintStatus, IssueStatus } from '@prisma/client';

describe('SprintsService', () => {
  let service: SprintsService;

  const mockPrismaService = {
    project: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    sprint: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    issue: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    activityEvent: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPrismaService.sprint.findMany.mockResolvedValue([]);
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SprintsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SprintsService>(SprintsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a sprint successfully', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'proj-1', name: 'Inbox CRM' });
      mockPrismaService.sprint.create.mockResolvedValue({
        id: 'sprint-1',
        projectId: 'proj-1',
        name: 'Sprint 1',
        startDate: new Date('2026-11-01'),
        endDate: new Date('2026-11-15'),
        status: SprintStatus.planned,
      });

      const result = await service.create({
        projectId: 'proj-1',
        name: 'Sprint 1',
        startDate: '2026-11-01T00:00:00.000Z',
        endDate: '2026-11-15T00:00:00.000Z',
      });

      expect(result.id).toBe('sprint-1');
      expect(mockPrismaService.sprint.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if project does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.create({
          projectId: 'nonexistent',
          name: 'Sprint 1',
          startDate: '2026-11-01T00:00:00.000Z',
          endDate: '2026-11-15T00:00:00.000Z',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if endDate <= startDate', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'proj-1', name: 'Inbox CRM' });

      await expect(
        service.create({
          projectId: 'proj-1',
          name: 'Sprint 1',
          startDate: '2026-11-15T00:00:00.000Z',
          endDate: '2026-11-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('start', () => {
    it('should throw ConflictException if project already has an active sprint', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue({
        id: 'sprint-2',
        projectId: 'proj-1',
        name: 'Sprint 2',
        status: SprintStatus.planned,
      });
      mockPrismaService.sprint.findFirst.mockResolvedValue({
        id: 'sprint-1',
        name: 'Sprint 1',
        status: SprintStatus.active,
      });

      await expect(service.start('sprint-2')).rejects.toThrow(ConflictException);
    });

    it('should start planned sprint successfully', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue({
        id: 'sprint-2',
        projectId: 'proj-1',
        name: 'Sprint 2',
        status: SprintStatus.planned,
      });
      mockPrismaService.sprint.findFirst.mockResolvedValue(null);
      mockPrismaService.sprint.update.mockResolvedValue({
        id: 'sprint-2',
        status: SprintStatus.active,
      });

      const result = await service.start('sprint-2');
      expect(result.status).toBe(SprintStatus.active);
    });
  });

  describe('complete', () => {
    it('should reject completing non-active sprint', async () => {
      mockPrismaService.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          sprint: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'sprint-1',
              status: SprintStatus.planned,
            }),
          },
        });
      });

      await expect(service.complete('sprint-1', {})).rejects.toThrow(BadRequestException);
    });

    it('should complete active sprint and rollover unresolved issues', async () => {
      const mockTx = {
        sprint: {
          findUnique: vi.fn().mockImplementation(({ where }: any) => {
            if (where.id === 'sprint-1') {
              return { id: 'sprint-1', projectId: 'proj-1', name: 'Sprint 1', status: SprintStatus.active };
            }
            if (where.id === 'sprint-2') {
              return { id: 'sprint-2', projectId: 'proj-1', name: 'Sprint 2', status: SprintStatus.planned };
            }
            return null;
          }),
          update: vi.fn().mockResolvedValue({
            id: 'sprint-1',
            status: SprintStatus.completed,
          }),
        },
        issue: {
          findMany: vi.fn().mockResolvedValue([{ id: 'INB-101' }, { id: 'INB-102' }]),
          updateMany: vi.fn().mockResolvedValue({ count: 2 }),
          count: vi.fn().mockResolvedValue(3),
        },
        activityEvent: {
          create: vi.fn().mockResolvedValue({}),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

      const result = await service.complete('sprint-1', { targetSprintId: 'sprint-2' }, 'user-1');
      expect(result.sprint.status).toBe(SprintStatus.completed);
      expect(result.rolledOverIssuesCount).toBe(2);
      expect(mockTx.issue.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['INB-101', 'INB-102'] } },
        data: { sprintId: 'sprint-2' },
      });
    });
  });

  describe('remove', () => {
    it('should delete sprint and unassign issues', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue({
        id: 'sprint-1',
        name: 'Sprint 1',
        projectId: 'proj-1',
        _count: { issues: 4 },
      });
      mockPrismaService.sprint.delete.mockResolvedValue({});

      const result = await service.remove('sprint-1');
      expect(result.success).toBe(true);
      expect(mockPrismaService.sprint.delete).toHaveBeenCalledWith({ where: { id: 'sprint-1' } });
    });
  });
});
