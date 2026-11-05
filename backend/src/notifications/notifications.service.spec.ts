import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;

  const mockNotification = {
    id: 'notif-1',
    userId: 'user-1',
    title: 'Ticket Assigned',
    message: 'You have been assigned to PROJ-101',
    type: NotificationType.assignment,
    read: false,
    issueId: 'issue-101',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      notification: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllForUser', () => {
    it('should return list of notifications for user', async () => {
      prisma.notification.findMany.mockResolvedValue([mockNotification]);

      const result = await service.findAllForUser('user-1');

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([mockNotification]);
    });
  });

  describe('markAsRead', () => {
    it('should mark unread notification as read', async () => {
      prisma.notification.findUnique.mockResolvedValue(mockNotification);
      prisma.notification.update.mockResolvedValue({ ...mockNotification, read: true });

      const result = await service.markAsRead('notif-1', 'user-1');

      expect(result.read).toBe(true);
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { read: true },
      });
    });

    it('should be idempotent if notification is already read', async () => {
      prisma.notification.findUnique.mockResolvedValue({ ...mockNotification, read: true });

      const result = await service.markAsRead('notif-1', 'user-1');

      expect(result.read).toBe(true);
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if notification does not exist', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      await expect(service.markAsRead('non-existent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if notification belongs to another user', async () => {
      prisma.notification.findUnique.mockResolvedValue(mockNotification);

      await expect(service.markAsRead('notif-1', 'other-user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should update all unread notifications for user', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllAsRead('user-1');

      expect(result).toEqual({ success: true, count: 5 });
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: false },
        data: { read: true },
      });
    });
  });

  describe('createNotification', () => {
    it('should suppress notification when actor is recipient', async () => {
      const result = await service.createNotification({
        userId: 'user-1',
        actorId: 'user-1',
        title: 'Self Action',
        message: 'Self created',
      });

      expect(result).toBeNull();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('should create notification when actor is different from recipient', async () => {
      prisma.notification.create.mockResolvedValue(mockNotification);

      const result = await service.createNotification({
        userId: 'user-1',
        actorId: 'user-2',
        title: 'Ticket Assigned',
        message: 'You have been assigned to PROJ-101',
      });

      expect(result).toEqual(mockNotification);
      expect(prisma.notification.create).toHaveBeenCalled();
    });
  });
});
