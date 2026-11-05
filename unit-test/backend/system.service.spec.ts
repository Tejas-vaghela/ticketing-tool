const vi = jest;
import { Test, TestingModule } from '@nestjs/testing';
import { SystemService } from './system.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';

describe('SystemService', () => {
  let service: SystemService;

  const mockPrismaService = {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    user: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    project: {
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    epic: {
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    sprint: {
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    issue: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    comment: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    attachment: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    escalationRecord: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    activityEvent: {
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    notification: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    savedFilter: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    settings: {
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  };

  const mockConfigService = {
    get: vi.fn((key: string, defaultVal: any) => {
      if (key === 'NODE_ENV') return 'test';
      return defaultVal;
    }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<SystemService>(SystemService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return status ok when database ping succeeds', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ 1: 1 }]);

      const health = await service.getHealth();

      expect(health.status).toBe('ok');
      expect(health.services.database.status).toBe('up');
      expect(health.services.application.status).toBe('up');
      expect(typeof health.services.database.latencyMs).toBe('number');
      expect(typeof health.uptime).toBe('number');
      expect(health.timestamp).toBeDefined();
    });

    it('should return status error when database ping fails', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Connection terminated'));

      const health = await service.getHealth();

      expect(health.status).toBe('error');
      expect(health.services.database.status).toBe('down');
      expect(health.services.database.error).toBeDefined();
    });
  });

  describe('getInfo', () => {
    it('should return runtime information and telemetry', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ 1: 1 }]);

      const info = await service.getInfo();

      expect(info.success).toBe(true);
      expect(info.data.application.name).toContain('Inbox Ticketing');
      expect(info.data.application.environment).toBe('test');
      expect(info.data.runtime.nodeVersion).toBe(process.version);
      expect(info.data.runtime.platform).toBe(process.platform);
      expect(info.data.database.provider).toBe('postgresql');
      expect(info.data.database.connectionStatus).toBe('connected');
    });
  });

  describe('exportDatabase', () => {
    it('should query all operational models and return structured snapshot', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([{ id: 'user-1', name: 'Alice' }]);
      mockPrismaService.project.findMany.mockResolvedValue([{ id: 'proj-1', key: 'INB' }]);
      mockPrismaService.epic.findMany.mockResolvedValue([]);
      mockPrismaService.sprint.findMany.mockResolvedValue([]);
      mockPrismaService.issue.findMany.mockResolvedValue([]);
      mockPrismaService.comment.findMany.mockResolvedValue([]);
      mockPrismaService.attachment.findMany.mockResolvedValue([]);
      mockPrismaService.escalationRecord.findMany.mockResolvedValue([]);
      mockPrismaService.activityEvent.findMany.mockResolvedValue([]);
      mockPrismaService.notification.findMany.mockResolvedValue([]);
      mockPrismaService.savedFilter.findMany.mockResolvedValue([]);
      mockPrismaService.settings.findFirst.mockResolvedValue({ id: 'singleton' });

      const result = await service.exportDatabase('admin-1');

      expect(result.version).toBe('1.0.0');
      expect(result.exportedBy).toBe('admin-1');
      expect(result.recordCounts.users).toBe(1);
      expect(result.recordCounts.projects).toBe(1);
      expect(result.recordCounts.settings).toBe(1);
      expect(result.data.users).toEqual([{ id: 'user-1', name: 'Alice' }]);
      expect(mockPrismaService.activityEvent.create).toHaveBeenCalledWith({
        data: {
          userId: 'admin-1',
          action: 'SYSTEM_EXPORT',
          details: expect.any(String),
        },
      });
    });
  });

  describe('importDatabase', () => {
    it('should throw BadRequestException if data is missing', async () => {
      await expect(service.importDatabase({ version: '1.0.0', data: null as any })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should execute restore transaction when valid payload is provided', async () => {
      const mockPayload = {
        version: '1.0.0',
        data: {
          users: [{ id: 'user-1', email: 'test@example.com', name: 'Test' }],
          projects: [{ id: 'proj-1', key: 'TEST', name: 'Test Proj', leadId: 'user-1' }],
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        const mockTx = {
          attachment: { deleteMany: vi.fn(), createMany: vi.fn() },
          comment: { deleteMany: vi.fn(), createMany: vi.fn() },
          escalationRecord: { deleteMany: vi.fn(), createMany: vi.fn() },
          activityEvent: { deleteMany: vi.fn(), create: vi.fn(), createMany: vi.fn() },
          notification: { deleteMany: vi.fn(), createMany: vi.fn() },
          savedFilter: { deleteMany: vi.fn(), createMany: vi.fn() },
          issue: { deleteMany: vi.fn(), createMany: vi.fn() },
          epic: { deleteMany: vi.fn(), createMany: vi.fn() },
          sprint: { deleteMany: vi.fn(), createMany: vi.fn() },
          project: { deleteMany: vi.fn(), createMany: vi.fn().mockResolvedValue({ count: 1 }) },
          user: { deleteMany: vi.fn(), createMany: vi.fn().mockResolvedValue({ count: 1 }) },
          settings: { deleteMany: vi.fn(), create: vi.fn() },
        };
        return cb(mockTx);
      });

      const res = await service.importDatabase(mockPayload, 'admin-1');

      expect(res.success).toBe(true);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('resetToFactorySeed', () => {
    it('should reset database and seed initial models atomically', async () => {
      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        const mockTx = {
          attachment: { deleteMany: vi.fn() },
          comment: { deleteMany: vi.fn() },
          escalationRecord: { deleteMany: vi.fn() },
          activityEvent: { deleteMany: vi.fn(), create: vi.fn() },
          notification: { deleteMany: vi.fn() },
          savedFilter: { deleteMany: vi.fn() },
          issue: { deleteMany: vi.fn() },
          epic: { deleteMany: vi.fn(), create: vi.fn() },
          sprint: { deleteMany: vi.fn(), create: vi.fn() },
          project: { deleteMany: vi.fn(), create: vi.fn().mockResolvedValue({ id: 'proj-1' }) },
          user: { deleteMany: vi.fn(), createMany: vi.fn() },
          settings: { deleteMany: vi.fn(), create: vi.fn() },
        };
        return cb(mockTx);
      });

      const res = await service.resetToFactorySeed('admin-1');

      expect(res.success).toBe(true);
      expect(res.message).toContain('factory seed data');
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });
});
