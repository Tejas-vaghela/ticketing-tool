import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;

  const mockSafeUser = {
    id: 'user-1',
    name: 'Tejas Vaghela',
    email: 'admin@example.com',
    role: UserRole.Admin,
    department: 'Engineering',
    supportLevels: ['L1', 'L2'],
    avatar: 'https://avatar.url',
    timezone: 'UTC',
    status: 'Active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      issue: {
        count: jest.fn().mockResolvedValue(0),
      },
      project: {
        count: jest.fn().mockResolvedValue(0),
      },
      comment: {
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated user list', async () => {
      prisma.$transaction.mockResolvedValue([[mockSafeUser], 1]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.data).toEqual([mockSafeUser]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should build filter query with role and search', async () => {
      prisma.$transaction.mockResolvedValue([[mockSafeUser], 1]);

      await service.findAll({ search: 'tejas', role: UserRole.Admin });

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return user if found', async () => {
      prisma.user.findUnique.mockResolvedValue(mockSafeUser);

      const result = await service.findOne('user-1');
      expect(result).toEqual(mockSafeUser);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should hash password and create a user', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue(mockSafeUser);

      const dto = {
        name: 'Tejas Vaghela',
        email: 'Admin@Example.com',
        password: 'PlainTextPassword123!',
        department: 'Engineering',
        role: UserRole.Admin,
      };

      const result = await service.create(dto);

      expect(bcrypt.hash).toHaveBeenCalledWith('PlainTextPassword123!', 10);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'admin@example.com',
            password: 'hashed-password',
            role: UserRole.Admin,
            department: 'Engineering',
          }),
        }),
      );
      expect(result).toEqual(mockSafeUser);
    });
  });

  describe('update', () => {
    it('should allow Admin to update another user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockSafeUser);
      prisma.user.update.mockResolvedValue({ ...mockSafeUser, name: 'Updated Name' });

      const result = await service.update(
        'user-1',
        { name: 'Updated Name' },
        { id: 'admin-id', role: UserRole.Admin },
      );

      expect(result.name).toBe('Updated Name');
    });

    it('should prevent non-admin from updating another user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockSafeUser);

      await expect(
        service.update(
          'user-1',
          { name: 'Hacked' },
          { id: 'user-2', role: UserRole.Viewer },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should prevent non-admin from assigning Admin role', async () => {
      prisma.user.findUnique.mockResolvedValue(mockSafeUser);

      await expect(
        service.update(
          'user-1',
          { role: UserRole.Admin },
          { id: 'user-1', role: UserRole.Project_Manager },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should prevent user from changing their own role', async () => {
      prisma.user.findUnique.mockResolvedValue(mockSafeUser);

      await expect(
        service.update(
          'user-1',
          { role: UserRole.Developer },
          { id: 'user-1', role: UserRole.Viewer },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should allow deletion of a user with no dependencies', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockSafeUser, role: UserRole.Viewer });
      prisma.issue.count.mockResolvedValue(0);
      prisma.project.count.mockResolvedValue(0);
      prisma.comment.count.mockResolvedValue(0);
      prisma.user.delete.mockResolvedValue(mockSafeUser);

      const result = await service.remove('user-2', { id: 'admin-id', role: UserRole.Admin });

      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-2' } });
      expect(result.message).toContain('permanently deleted');
    });

    it('should prevent deletion of user who leads a project', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockSafeUser, role: UserRole.Viewer });
      prisma.project.count.mockResolvedValue(2);

      await expect(
        service.remove('user-2', { id: 'admin-id', role: UserRole.Admin }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent admin from deleting their own account', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockSafeUser, id: 'admin-id' });

      await expect(
        service.remove('admin-id', { id: 'admin-id', role: UserRole.Admin }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
