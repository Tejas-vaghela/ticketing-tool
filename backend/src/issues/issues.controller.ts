import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IssuesService } from './issues.service.js';
import { CreateIssueDto } from './dto/create-issue.dto.js';
import { UpdateIssueDto } from './dto/update-issue.dto.js';
import { EscalateIssueDto } from './dto/escalate-issue.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { QueryIssuesDto } from './dto/query-issues.dto.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('issues')
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  /**
   * POST /api/issues
   * Create a new ticket with automatic ID generation and SLA math.
   * Allowed for all roles except Viewer.
   */
  @Post()
  @Roles(
    UserRole.Admin,
    UserRole.Project_Manager,
    UserRole.Developer,
    UserRole.QA,
    UserRole.Support_Agent,
    UserRole.Technical,
    UserRole.Engineer,
  )
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateIssueDto, @CurrentUser() user: any) {
    const userId = user.id || user.sub;
    return this.issuesService.create(dto, userId);
  }

  /**
   * GET /api/issues
   * Retrieve list of issues matching filters, keyword search, and pagination.
   */
  @Get()
  async findAll(@Query() query: QueryIssuesDto, @CurrentUser() user?: any) {
    const userId = user?.id || user?.sub;
    return userId
      ? this.issuesService.findAll(query, userId)
      : this.issuesService.findAll(query);
  }

  /**
   * GET /api/issues/:id
   * Retrieve complete ticket details by ID with comments, attachments, and escalation history.
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.issuesService.findOne(id);
  }

  /**
   * PATCH /api/issues/:id
   * Update mutable fields of an issue.
   */
  @Patch(':id')
  @Roles(
    UserRole.Admin,
    UserRole.Project_Manager,
    UserRole.Developer,
    UserRole.QA,
    UserRole.Support_Agent,
    UserRole.Technical,
    UserRole.Engineer,
  )
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateIssueDto,
    @CurrentUser() user: any,
  ) {
    const userId = user.id || user.sub;
    return this.issuesService.update(id, dto, userId);
  }

  /**
   * PATCH /api/issues/:id/status
   * Dedicated status transition endpoint (e.g. Kanban board drag-and-drop).
   */
  @Patch(':id/status')
  @Roles(
    UserRole.Admin,
    UserRole.Project_Manager,
    UserRole.Developer,
    UserRole.QA,
    UserRole.Support_Agent,
    UserRole.Technical,
    UserRole.Engineer,
  )
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: any,
  ) {
    const userId = user.id || user.sub;
    return this.issuesService.updateStatus(id, dto, userId);
  }

  /**
   * POST /api/issues/:id/escalate
   * Escalate issue tier with mandatory justification, internal note, and audit event.
   */
  @Post(':id/escalate')
  @Roles(
    UserRole.Admin,
    UserRole.Project_Manager,
    UserRole.Support_Agent,
    UserRole.Technical,
    UserRole.Engineer,
  )
  @HttpCode(HttpStatus.OK)
  async escalate(
    @Param('id') id: string,
    @Body() dto: EscalateIssueDto,
    @CurrentUser() user: any,
  ) {
    const userId = user.id || user.sub;
    return this.issuesService.escalate(id, dto, userId);
  }

  /**
   * GET /api/issues/:id/comments
   * Retrieve comments for a specific issue.
   */
  @Get(':id/comments')
  async listComments(@Param('id') id: string) {
    return this.issuesService.listComments(id);
  }

  /**
   * POST /api/issues/:id/comments
   * Add a new comment to an issue and notify participants.
   */
  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  async addComment(
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: any,
  ) {
    const userId = user.id || user.sub;
    return this.issuesService.addComment(id, dto, userId);
  }

  /**
   * DELETE /api/issues/:id
   * Remove issue permanently. Restricted strictly to Admin and Project Manager.
   */
  @Delete(':id')
  @Roles(UserRole.Admin, UserRole.Project_Manager)
  async remove(@Param('id') id: string) {
    return this.issuesService.remove(id);
  }
}
