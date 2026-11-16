import { Test, TestingModule } from '@nestjs/testing';
import { SavedFiltersService } from './saved-filters.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('SavedFiltersService', () => {
  let service: SavedFiltersService;
  let prisma: any;

  const mockFilter = {
    id: 'filter-1',
    name: 'High Priority Bugs',
    userId: 'user-1',
    filters: { priority: 'High', status: 'Open' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      savedFilter: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavedFiltersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<SavedFiltersService>(SavedFiltersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return saved filters belonging to user', async () => {
      prisma.savedFilter.findMany.mockResolvedValue([mockFilter]);

      const result = await service.findAll('user-1');

      expect(prisma.savedFilter.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([mockFilter]);
    });
  });

  describe('findOne', () => {
    it('should return filter if owned by user', async () => {
      prisma.savedFilter.findUnique.mockResolvedValue(mockFilter);

      const result = await service.findOne('filter-1', 'user-1');
      expect(result).toEqual(mockFilter);
    });

    it('should throw NotFoundException if filter does not exist', async () => {
      prisma.savedFilter.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if filter belongs to another user', async () => {
      prisma.savedFilter.findUnique.mockResolvedValue(mockFilter);

      await expect(service.findOne('filter-1', 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('create', () => {
    it('should create new filter for user', async () => {
      prisma.savedFilter.create.mockResolvedValue(mockFilter);

      const dto = { name: 'High Priority Bugs', filters: { priority: 'High' } };
      const result = await service.create('user-1', dto);

      expect(prisma.savedFilter.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          name: 'High Priority Bugs',
          filters: { priority: 'High' },
        },
      });
      expect(result).toEqual(mockFilter);
    });
  });

  describe('update', () => {
    it('should update filter if user is owner', async () => {
      prisma.savedFilter.findUnique.mockResolvedValue(mockFilter);
      prisma.savedFilter.update.mockResolvedValue({
        ...mockFilter,
        name: 'Updated Name',
      });

      const result = await service.update('filter-1', 'user-1', {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
    });
  });

  describe('remove', () => {
    it('should remove filter if user is owner', async () => {
      prisma.savedFilter.findUnique.mockResolvedValue(mockFilter);
      prisma.savedFilter.delete.mockResolvedValue(mockFilter);

      const result = await service.remove('filter-1', 'user-1');

      expect(prisma.savedFilter.delete).toHaveBeenCalledWith({ where: { id: 'filter-1' } });
      expect(result).toEqual({ success: true });
    });
  });
});

