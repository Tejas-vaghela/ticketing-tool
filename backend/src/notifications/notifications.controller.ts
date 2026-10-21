import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationsService, MarkAllReadResult } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Notification, UserRole } from '@prisma/client';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /api/notifications
   * Return notifications belonging exclusively to the authenticated user, newest first.
   */
  @Get()
  async findAll(@CurrentUser() user: { id: string }): Promise<Notification[]> {
    return this.notificationsService.findAllForUser(user.id);
  }

  /**
   * GET /api/notifications/unread-count
   * Return unread notification count for the authenticated user.
   */
  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: { id: string }): Promise<{ count: number; unreadCount: number }> {
    const { count } = await this.notificationsService.getUnreadCount(user.id);
    return { count, unreadCount: count };
  }

  /**
   * PATCH /api/notifications/:id/read
   * Mark the specified notification as read only if it belongs to the authenticated user.
   */
  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ): Promise<Notification> {
    return this.notificationsService.markAsRead(id, user.id);
  }

  /**
   * POST /api/notifications/mark-all-read
   * Mark all unread notifications belonging to the authenticated user as read.
   */
  @Post('mark-all-read')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(
    @CurrentUser() user: { id: string },
  ): Promise<MarkAllReadResult> {
    return this.notificationsService.markAllAsRead(user.id);
  }

  /**
   * POST /api/notifications/system-alert
   * Broadcast or target system alert notifications (Admin only).
   */
  @Post('system-alert')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.OK)
  async sendSystemAlert(
    @Body() dto: { title: string; message: string; targetUserIds?: string[] },
    @CurrentUser() user: { id: string },
  ) {
    return this.notificationsService.sendSystemAlert(dto, user.id);
  }
}
