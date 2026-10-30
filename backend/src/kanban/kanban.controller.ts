import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { KanbanService } from './kanban.service.js';
import { GetKanbanBoardDto } from './dto/get-kanban-board.dto.js';
import { UpdateKanbanStatusDto } from './dto/update-kanban-status.dto.js';
import { MoveKanbanIssueDto } from './dto/move-kanban-issue.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('kanban')
export class KanbanController {
  constructor(private readonly kanbanService: KanbanService) {}

  /**
   * GET /api/kanban/columns
   * Return predefined Kanban workflow columns and visual metadata.
   */
  @Get('columns')
  getColumns() {
    return this.kanbanService.getColumns();
  }

  /**
   * GET /api/kanban/board
   * Retrieve Kanban board issues filtered from PostgreSQL and grouped by column.
   */
  @Get('board')
  async getBoard(@Query() dto: GetKanbanBoardDto, @CurrentUser() user?: any) {
    const userId = user?.id || user?.sub;
    return this.kanbanService.getBoard(dto, userId);
  }

  /**
   * GET /api/kanban/issues/:id
   * Retrieve issue details with comments, attachments, and escalation history.
   */
  @Get('issues/:id')
  async getIssue(@Param('id') id: string) {
    return this.kanbanService.getIssue(id);
  }

  /**
   * PATCH /api/kanban/issues/:id/status
   * Dedicated status transition endpoint for Kanban drag-and-drop.
   */
  @Patch('issues/:id/status')
  @Roles(
    UserRole.Admin,
    UserRole.Project_Manager,
    UserRole.Developer,
    UserRole.QA,
    UserRole.Support_Agent,
    UserRole.Technical,
    UserRole.Engineer,
  )
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateKanbanStatusDto,
    @CurrentUser() user: any,
  ) {
    const userId = user?.id || user?.sub;
    return this.kanbanService.updateStatus(id, dto, userId);
  }

  /**
   * PATCH /api/kanban/issues/:id/move
   * Move issue to a destination status/column and optional sprint.
   */
  @Patch('issues/:id/move')
  @Roles(
    UserRole.Admin,
    UserRole.Project_Manager,
    UserRole.Developer,
    UserRole.QA,
    UserRole.Support_Agent,
    UserRole.Technical,
    UserRole.Engineer,
  )
  @HttpCode(HttpStatus.OK)
  async moveIssue(
    @Param('id') id: string,
    @Body() dto: MoveKanbanIssueDto,
    @CurrentUser() user: any,
  ) {
    const userId = user?.id || user?.sub;
    return this.kanbanService.moveIssue(id, dto, userId);
  }
}
