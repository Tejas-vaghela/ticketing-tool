import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Notification, NotificationType, Prisma } from '@prisma/client';

export interface CreateNotificationDto {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  issueId?: string | null;
  actorId?: string;
}

export interface MarkAllReadResult {
  success: boolean;
  count: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieve all notifications for the authenticated user, ordered newest first.
   */
  async findAllForUser(userId: string): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Mark a single notification as read if it belongs to the authenticated user.
   * Idempotent: re-marking an already-read notification succeeds and returns read: true.
   * Throws NotFoundException if notification does not exist or belongs to another user.
   */
  async markAsRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException(`Notification with identifier ${id} not found.`);
    }

    if (notification.read) {
      return notification;
    }

    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  /**
   * Mark all unread notifications belonging to the authenticated user as read in an atomic update.
   */
  async markAllAsRead(userId: string): Promise<MarkAllReadResult> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
      },
    });

    return {
      success: true,
      count: result.count,
    };
  }

  /**
   * Reusable notification creation service method.
   * Can participate in a caller-provided Prisma interactive transaction (`tx`).
   * Suppresses self-notifications when actorId matches recipient userId.
   */
  async createNotification(
    data: CreateNotificationDto,
    tx?: Prisma.TransactionClient,
  ): Promise<Notification | null> {
    // Suppress self-notifications
    if (data.actorId && data.actorId === data.userId) {
      return null;
    }

    const client = tx || this.prisma;
    try {
      const created = await client.notification.create({
        data: {
          userId: data.userId,
          title: data.title.trim(),
          message: data.message.trim(),
          type: data.type || NotificationType.system,
          issueId: data.issueId || null,
        },
      });

      return created;
    } catch (error) {
      this.logger.error(
        `Failed to create notification for user ${data.userId}: ${error instanceof Error ? error.message : error}`,
      );
      throw error;
    }
  }

  /**
   * Return unread notification count for user via PostgreSQL indexed query.
   */
  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });
    return { count };
  }

  /**
   * Broadcast or target system notification (System Alert).
   */
  async sendSystemAlert(
    dto: { title: string; message: string; targetUserIds?: string[] },
    actorId?: string,
  ): Promise<{ success: boolean; count: number }> {
    let recipients: string[] = dto.targetUserIds || [];
    if (!recipients.length) {
      const allUsers = await this.prisma.user.findMany({ select: { id: true } });
      recipients = allUsers.map((u) => u.id);
    }

    let createdCount = 0;
    for (const recipientId of recipients) {
      const res = await this.createNotification({
        userId: recipientId,
        title: dto.title.trim(),
        message: dto.message.trim(),
        type: NotificationType.system,
        actorId,
      });
      if (res) createdCount++;
    }

    return { success: true, count: createdCount };
  }
}
