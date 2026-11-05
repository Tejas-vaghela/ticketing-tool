import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: any;

  const mockProject = {
    id: 'proj-1',
    key: 'PROJ',
    name: 'Core Platform',
    description: 'Ticketing Platform',
    category: 'Software',
    leadId: 'user-1',
    memberIds: ['user-1'],
    status: ProjectStatus.Active,
    createdDate: new Date(),
    updatedDate: new Date(),
    lead: {
      id: 'user-1',
      name: 'Tejas Vaghela',
      email: 'admin@example.com',
      role: 'Admin',
      avatar: '',
    },
    members: [],
    _count: {
      issues: 10,
      sprints: 2,
      epics: 1,
    },
  };

  beforeEach(async () => {
    prisma = {
      project: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      issue: {
        count: jest.fn().mockResolvedValue(5),
        groupBy: jest.fn().mockResolvedValue([{ projectId: 'proj-1', _count: { _all: 5 } }]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return list of projects with active issue count', async () => {
      prisma.project.findMany.mockResolvedValue([mockProject]);
      prisma.issue.count.mockResolvedValue(5);

      const result = await service.findAll({});

      expect(prisma.project.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('PROJ');
      expect(result[0].activeIssueCount).toBe(5);
    });
  });

  describe('findOne', () => {
    it('should return project details with metrics', async () => {
      const detailMock = {
        ...mockProject,
        sprints: [],
        epics: [],
      };
      prisma.project.findFirst.mockResolvedValue(detailMock);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.issue.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(3)  // open
        .mockResolvedValueOnce(4)  // inProgress
        .mockResolvedValueOnce(3); // resolved

      const result = await service.findOne('proj-1');

      expect(result.id).toBe('proj-1');
      expect(result.metrics.totalIssues).toBe(10);
      expect(result.metrics.openIssues).toBe(3);
      expect(result.metrics.inProgressIssues).toBe(4);
      expect(result.metrics.resolvedIssues).toBe(3);
    });

    it('should throw NotFoundException if project not found', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a project with provided key', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      prisma.project.create.mockResolvedValue(mockProject);
      prisma.issue.count.mockResolvedValue(0);

      const dto = {
        key: 'PROJ',
        name: 'Core Platform',
        leadId: 'user-1',
        description: 'Ticketing Platform',
      };

      const result = await service.create(dto);

      expect(prisma.project.create).toHaveBeenCalled();
      expect(result.key).toBe('PROJ');
    });

    it('should throw ConflictException if project key already exists', async () => {
      prisma.project.findUnique.mockResolvedValue(mockProject);

      const dto = {
        key: 'PROJ',
        name: 'Another Project',
        leadId: 'user-1',
      };

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should update an existing project', async () => {
      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.project.update.mockResolvedValue({
        ...mockProject,
        name: 'Updated Platform Name',
      });
      prisma.issue.count.mockResolvedValue(2);

      const result = await service.update('proj-1', { name: 'Updated Platform Name' });

      expect(result.name).toBe('Updated Platform Name');
    });

    it('should throw NotFoundException when updating non-existent project', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(service.update('invalid-id', { name: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete project and return message', async () => {
      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.project.delete.mockResolvedValue(mockProject);

      const result = await service.remove('proj-1');

      expect(prisma.project.delete).toHaveBeenCalledWith({ where: { id: 'proj-1' } });
      expect(result.message).toContain('permanently deleted');
    });

    it('should throw NotFoundException if project does not exist', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(service.remove('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });
});
