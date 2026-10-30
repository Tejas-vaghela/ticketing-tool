import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InternalServerErrorException } from '@nestjs/common';
import {
  IssueType,
  IssueStatus,
  Priority,
  SupportLevel,
  ProjectStatus,
  EpicStatus,
  SprintStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';

describe('SearchService', () => {
  let service: SearchService;

  const mockPrismaService = {
    project: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    issue: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    epic: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    sprint: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('search', () => {
    it('should return empty result immediately when query is empty or whitespace', async () => {
      const result = await service.search({ q: '' });

      expect(result.success).toBe(true);
      expect(result.totalCount).toBe(0);
      expect(result.issues).toEqual([]);
      expect(result.projects).toEqual([]);
      expect(result.epics).toEqual([]);
      expect(result.sprints).toEqual([]);
      expect(result.users).toEqual([]);
      expect(result.data.results).toEqual([]);
      expect(mockPrismaService.issue.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.project.findMany).not.toHaveBeenCalled();
    });

    it('should execute multi-entity search across all models when type is all', async () => {
      const mockIssues = [
        {
          id: 'INB-1001',
          title: 'Payment timeout issue',
          description: 'Gateway failure',
          type: IssueType.Bug,
          status: IssueStatus.Open,
          priority: Priority.High,
          supportLevel: SupportLevel.L1,
          projectId: 'proj-1',
          labels: ['payment'],
          createdDate: new Date(),
          updatedDate: new Date(),
          project: { id: 'proj-1', key: 'INB', name: 'Inbox Platform' },
          assignee: { id: 'user-1', name: 'Alice', email: 'alice@test.com', avatar: '' },
          sprint: null,
          epic: null,
        },
      ];

      const mockProjects = [
        {
          id: 'proj-1',
          key: 'INB',
          name: 'Inbox Platform',
          description: 'Core repository',
          status: ProjectStatus.Active,
          category: 'Software',
          createdDate: new Date(),
          lead: { id: 'user-2', name: 'Bob', email: 'bob@test.com' },
        },
      ];

      const mockEpics = [
        {
          id: 'epic-1',
          projectId: 'proj-1',
          name: 'Payment Overhaul',
          description: 'Rebuild gateway',
          summary: 'Payments',
          color: '#3b82f6',
          status: EpicStatus.In_Progress,
          dueDate: null,
          createdAt: new Date(),
          project: { id: 'proj-1', key: 'INB', name: 'Inbox Platform' },
        },
      ];

      const mockSprints = [
        {
          id: 'sprint-1',
          projectId: 'proj-1',
          name: 'Sprint 1 - Payment',
          goal: 'Fix gateway',
          status: SprintStatus.active,
          startDate: new Date(),
          endDate: new Date(),
          completedDate: null,
          createdAt: new Date(),
          project: { id: 'proj-1', key: 'INB', name: 'Inbox Platform' },
        },
      ];

      const mockUsers = [
        {
          id: 'user-1',
          name: 'Payment Team Bot',
          email: 'bot@test.com',
          role: UserRole.Developer,
          department: 'Engineering',
          avatar: '',
          status: UserStatus.Active,
          timezone: 'UTC',
        },
      ];

      mockPrismaService.issue.findMany.mockResolvedValue(mockIssues);
      mockPrismaService.issue.count.mockResolvedValue(1);

      mockPrismaService.project.findMany.mockResolvedValue(mockProjects);
      mockPrismaService.project.count.mockResolvedValue(1);

      mockPrismaService.epic.findMany.mockResolvedValue(mockEpics);
      mockPrismaService.epic.count.mockResolvedValue(1);

      mockPrismaService.sprint.findMany.mockResolvedValue(mockSprints);
      mockPrismaService.sprint.count.mockResolvedValue(1);

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.user.count.mockResolvedValue(1);

      const result = await service.search({ q: 'payment' });

      expect(result.success).toBe(true);
      expect(result.totalCount).toBe(5);
      expect(result.issues.length).toBe(1);
      expect(result.projects.length).toBe(1);
      expect(result.epics.length).toBe(1);
      expect(result.sprints.length).toBe(1);
      expect(result.users.length).toBe(1);
      expect(result.data.results.length).toBe(5);

      // Verify URLs
      expect(result.issues[0].url).toBe('/issues/INB-1001');
      expect(result.projects[0].url).toBe('/projects/proj-1');
      expect(result.epics[0].url).toBe('/epics');
      expect(result.sprints[0].url).toBe('/backlog');
      expect(result.users[0].url).toBe('/team');
    });

    it('should scope search to only issues when type is issues', async () => {
      mockPrismaService.issue.findMany.mockResolvedValue([]);
      mockPrismaService.issue.count.mockResolvedValue(0);

      const result = await service.search({ q: 'login', type: 'issues' });

      expect(result.success).toBe(true);
      expect(mockPrismaService.issue.findMany).toHaveBeenCalled();
      expect(mockPrismaService.project.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.epic.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.sprint.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.user.findMany).not.toHaveBeenCalled();
    });

    it('should resolve project key or ID when projectId is provided', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      mockPrismaService.issue.findMany.mockResolvedValue([]);
      mockPrismaService.issue.count.mockResolvedValue(0);

      await service.search({ q: 'test', type: 'issues', projectId: 'INB' });

      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith({
        where: { OR: [{ id: 'INB' }, { key: 'INB' }] },
        select: { id: true },
      });

      expect(mockPrismaService.issue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'proj-1',
          }),
        }),
      );
    });

    it('should throw InternalServerErrorException on database failure', async () => {
      mockPrismaService.issue.findMany.mockRejectedValue(new Error('DB Connection Refused'));

      await expect(service.search({ q: 'crash', type: 'issues' })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
