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
import { EpicsService } from './epics.service.js';
import { CreateEpicDto } from './dto/create-epic.dto.js';
import { UpdateEpicDto } from './dto/update-epic.dto.js';
import { QueryEpicsDto } from './dto/query-epics.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('epics')
export class EpicsController {
  constructor(private readonly epicsService: EpicsService) {}

  /**
   * POST /api/epics
   * Create a new Epic. Restricted to Admin and Project Manager.
   */
  @Post()
  @Roles(UserRole.Admin, UserRole.Project_Manager)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateEpicDto, @CurrentUser() user: any) {
    const userId = user?.id || user?.sub;
    return this.epicsService.create(dto, userId);
  }

  /**
   * GET /api/epics
   * Retrieve list of epics with optional project, status, and search filters.
   */
  @Get()
  async findAll(@Query() query: QueryEpicsDto) {
    return this.epicsService.findAll(query);
  }

  /**
   * GET /api/epics/:id
   * Retrieve complete epic details with issues and calculated progress metrics.
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.epicsService.findOne(id);
  }

  /**
   * GET /api/epics/:id/issues
   * Retrieve all issues assigned to a specific epic.
   */
  @Get(':id/issues')
  async getIssues(@Param('id') id: string) {
    return this.epicsService.getEpicIssues(id);
  }

  /**
   * PATCH /api/epics/:id
   * Update mutable epic fields (name, description, summary, color, status, dueDate).
   */
  @Patch(':id')
  @Roles(UserRole.Admin, UserRole.Project_Manager)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEpicDto,
    @CurrentUser() user: any,
  ) {
    const userId = user?.id || user?.sub;
    return this.epicsService.update(id, dto, userId);
  }

  /**
   * DELETE /api/epics/:id
   * Delete epic. Safely unlinks contained issues by setting their epicId to null.
   */
  @Delete(':id')
  @Roles(UserRole.Admin, UserRole.Project_Manager)
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    const userId = user?.id || user?.sub;
    return this.epicsService.remove(id, userId);
  }

  /**
   * POST /api/epics/:id/issues/:issueId
   * Assign an existing issue to an epic.
   */
  @Post(':id/issues/:issueId')
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
  async assignIssue(
    @Param('id') id: string,
    @Param('issueId') issueId: string,
    @CurrentUser() user: any,
  ) {
    const userId = user?.id || user?.sub;
    return this.epicsService.assignIssue(id, issueId, userId);
  }

  /**
   * DELETE /api/epics/:id/issues/:issueId
   * Unlink an issue from an epic.
   */
  @Delete(':id/issues/:issueId')
  @Roles(
    UserRole.Admin,
    UserRole.Project_Manager,
    UserRole.Developer,
    UserRole.QA,
    UserRole.Support_Agent,
    UserRole.Technical,
    UserRole.Engineer,
  )
  async removeIssue(
    @Param('id') id: string,
    @Param('issueId') issueId: string,
    @CurrentUser() user: any,
  ) {
    const userId = user?.id || user?.sub;
    return this.epicsService.removeIssue(id, issueId, userId);
  }
}
