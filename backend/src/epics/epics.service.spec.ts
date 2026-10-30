import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { EpicsService } from './epics.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EpicStatus, IssueStatus } from '@prisma/client';

describe('EpicsService', () => {
  let service: EpicsService;

  const mockPrismaService = {
    project: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    epic: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    issue: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EpicsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<EpicsService>(EpicsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an epic successfully', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'proj-1', key: 'INB', name: 'Inbox CRM' });
      mockPrismaService.epic.create.mockResolvedValue({
        id: 'epic-1',
        projectId: 'proj-1',
        name: 'Customer Onboarding',
        color: '#3b82f6',
        status: EpicStatus.To_Do,
      });

      const dto = {
        projectId: 'proj-1',
        name: 'Customer Onboarding',
        color: '#3b82f6',
      };

      const result = await service.create(dto);
      expect(result.id).toBe('epic-1');
      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith({
        where: { OR: [{ id: 'proj-1' }, { key: 'proj-1' }] },
      });
      expect(mockPrismaService.epic.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if project does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.create({
          projectId: 'non-existent',
          name: 'Epic 1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid dueDate', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'proj-1', name: 'Inbox CRM' });

      await expect(
        service.create({
          projectId: 'proj-1',
          name: 'Epic 1',
          dueDate: 'invalid-date',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return epics with computed metrics', async () => {
      mockPrismaService.epic.findMany.mockResolvedValue([
        {
          id: 'epic-1',
          projectId: 'proj-1',
          name: 'Epic 1',
          status: EpicStatus.In_Progress,
          issues: [
            { id: 'INB-1', status: IssueStatus.Resolved, storyPoints: 5 },
            { id: 'INB-2', status: IssueStatus.In_Progress, storyPoints: 3 },
          ],
        },
      ]);
      mockPrismaService.epic.count.mockResolvedValue(1);

      const result = await service.findAll({});
      expect(result).toHaveLength(1);
      expect(result[0].metrics).toBeDefined();
      expect(result[0].metrics.totalIssues).toBe(2);
      expect(result[0].metrics.completedIssues).toBe(1);
      expect(result[0].metrics.totalStoryPoints).toBe(8);
      expect(result[0].metrics.completedStoryPoints).toBe(5);
      expect(result[0].metrics.progressPercentage).toBe(50);
    });
  });

  describe('findOne', () => {
    it('should return epic details with computed metrics', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue({
        id: 'epic-1',
        name: 'Epic 1',
        issues: [
          { id: 'INB-1', status: IssueStatus.Closed, storyPoints: 8 },
        ],
      });

      const result = await service.findOne('epic-1');
      expect(result.id).toBe('epic-1');
      expect(result.metrics.completedIssues).toBe(1);
      expect(result.metrics.progressPercentage).toBe(100);
    });

    it('should throw NotFoundException if epic does not exist', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update epic successfully', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue({ id: 'epic-1', name: 'Old Name' });
      mockPrismaService.epic.update.mockResolvedValue({ id: 'epic-1', name: 'New Name' });

      const result = await service.update('epic-1', { name: 'New Name' });
      expect(result.name).toBe('New Name');
    });

    it('should throw NotFoundException if updating non-existent epic', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue(null);

      await expect(service.update('invalid-id', { name: 'New Name' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove an epic successfully', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue({
        id: 'epic-1',
        name: 'Epic 1',
        _count: { issues: 2 },
      });
      mockPrismaService.epic.delete.mockResolvedValue({ id: 'epic-1' });

      const result = await service.remove('epic-1');
      expect(result.success).toBe(true);
      expect(mockPrismaService.epic.delete).toHaveBeenCalledWith({ where: { id: 'epic-1' } });
    });

    it('should throw NotFoundException if deleting non-existent epic', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue(null);

      await expect(service.remove('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignIssue and removeIssue', () => {
    it('should assign an issue to an epic', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue({ id: 'epic-1' });
      mockPrismaService.issue.findUnique.mockResolvedValue({ id: 'INB-1001' });
      mockPrismaService.issue.update.mockResolvedValue({ id: 'INB-1001', epicId: 'epic-1' });

      const result = await service.assignIssue('epic-1', 'INB-1001');
      expect(result.epicId).toBe('epic-1');
      expect(mockPrismaService.issue.update).toHaveBeenCalled();
    });

    it('should remove an issue from an epic', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue({ id: 'INB-1001', epicId: 'epic-1' });
      mockPrismaService.issue.update.mockResolvedValue({ id: 'INB-1001', epicId: null });

      const result = await service.removeIssue('epic-1', 'INB-1001');
      expect(mockPrismaService.issue.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException if removing issue not assigned to epic', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue({ id: 'INB-1001', epicId: 'different-epic' });

      await expect(service.removeIssue('epic-1', 'INB-1001')).rejects.toThrow(BadRequestException);
    });
  });
});
