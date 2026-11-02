import { Test, TestingModule } from '@nestjs/testing';
import { ActivityService } from '../../backend/src/activity/activity.service';
import { PrismaService } from '../../backend/src/prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ActivityService', () => {
  let service: ActivityService;
  let prisma: PrismaService;

  const mockPrisma = {
    activityEvent: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    issue: {
      findUnique: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<ActivityService>(ActivityService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getFeed', () => {
    it('should query activity events with default limit and return feed envelope', async () => {
      const mockItems = [
        {
          id: 'act-1',
          issueId: 'INB-1001',
          projectId: 'proj-1',
          userId: 'user-1',
          action: 'created',
          details: 'created ticket',
          timestamp: new Date(),
          user: { id: 'user-1', name: 'User 1', email: 'u1@test.com', avatar: null, role: 'Developer' },
          issue: { id: 'INB-1001', title: 'Issue 1' },
          project: { id: 'proj-1', key: 'INB', name: 'Inbox' },
        },
      ];

      mockPrisma.activityEvent.count.mockResolvedValue(1);
      mockPrisma.activityEvent.findMany.mockResolvedValue(mockItems);

      const result = await service.getFeed({});

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(mockPrisma.activityEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 21,
          orderBy: { timestamp: 'desc' },
        }),
      );
    });

    it('should throw NotFoundException if projectId does not exist', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(service.getFeed({ projectId: 'non-existent' })).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if issueId does not exist', async () => {
      mockPrisma.issue.findUnique.mockResolvedValue(null);

      await expect(service.getFeed({ issueId: 'INB-99999' })).rejects.toThrow(NotFoundException);
    });

    it('should apply keyset cursor pagination correctly', async () => {
      const mockItems = [
        { id: 'act-1', timestamp: new Date() },
        { id: 'act-2', timestamp: new Date() },
        { id: 'act-3', timestamp: new Date() }, // extra item for hasMore
      ];

      mockPrisma.activityEvent.count.mockResolvedValue(10);
      mockPrisma.activityEvent.findMany.mockResolvedValue(mockItems);

      const result = await service.getFeed({ limit: 2, cursor: 'act-0' });

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('act-2');
      expect(mockPrisma.activityEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'act-0' },
          skip: 1,
          take: 3,
        }),
      );
    });
  });

  describe('findByIssue', () => {
    it('should return events for existing issue', async () => {
      mockPrisma.issue.findUnique.mockResolvedValue({ id: 'INB-1001' });
      const mockEvents = [{ id: 'act-1', issueId: 'INB-1001', timestamp: new Date() }];
      mockPrisma.activityEvent.findMany.mockResolvedValue(mockEvents);

      const result = await service.findByIssue('INB-1001');

      expect(result).toHaveLength(1);
      expect(mockPrisma.activityEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { issueId: 'INB-1001' },
          orderBy: { timestamp: 'desc' },
        }),
      );
    });

    it('should throw NotFoundException for unknown issue', async () => {
      mockPrisma.issue.findUnique.mockResolvedValue(null);

      await expect(service.findByIssue('UNKNOWN')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByProject', () => {
    it('should return events for existing project', async () => {
      mockPrisma.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      const mockEvents = [{ id: 'act-1', projectId: 'proj-1', timestamp: new Date() }];
      mockPrisma.activityEvent.findMany.mockResolvedValue(mockEvents);

      const result = await service.findByProject('proj-1');

      expect(result).toHaveLength(1);
      expect(mockPrisma.activityEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'proj-1' },
          orderBy: { timestamp: 'desc' },
        }),
      );
    });

    it('should throw NotFoundException for unknown project', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(service.findByProject('UNKNOWN')).rejects.toThrow(NotFoundException);
    });
  });

  describe('logEvent', () => {
    it('should create an activity event with valid input', async () => {
      const mockEvent = {
        id: 'act-new',
        userId: 'user-1',
        action: 'created',
        details: 'created ticket',
        issueId: 'INB-1001',
        projectId: 'proj-1',
        timestamp: new Date(),
      };
      mockPrisma.activityEvent.create.mockResolvedValue(mockEvent);

      const result = await service.logEvent({
        userId: 'user-1',
        action: 'created',
        details: 'created ticket',
        issueId: 'INB-1001',
        projectId: 'proj-1',
      });

      expect(result).toEqual(mockEvent);
      expect(mockPrisma.activityEvent.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          action: 'created',
          details: 'created ticket',
          issueId: 'INB-1001',
          projectId: 'proj-1',
        },
      });
    });

    it('should throw BadRequestException if required fields are missing', async () => {
      await expect(
        service.logEvent({
          userId: '',
          action: 'created',
          details: 'test',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
