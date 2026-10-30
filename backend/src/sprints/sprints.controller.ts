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
import { SprintsService } from './sprints.service.js';
import { CreateSprintDto } from './dto/create-sprint.dto.js';
import { UpdateSprintDto } from './dto/update-sprint.dto.js';
import { CompleteSprintDto } from './dto/complete-sprint.dto.js';
import { QuerySprintsDto } from './dto/query-sprints.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sprints')
export class SprintsController {
  constructor(private readonly sprintsService: SprintsService) {}

  /**
   * POST /api/sprints
   * Create a new planned sprint. Restricted to Admin and Project Manager.
   */
  @Post()
  @Roles(UserRole.Admin, UserRole.Project_Manager)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateSprintDto, @CurrentUser() user: any) {
    const userId = user?.id || user?.sub;
    return this.sprintsService.create(dto, userId);
  }

  /**
   * GET /api/sprints
   * Retrieve list of sprints with optional project and status filters.
   */
  @Get()
  async findAll(@Query() query: QuerySprintsDto) {
    return this.sprintsService.findAll(query);
  }

  /**
   * GET /api/sprints/:id
   * Retrieve complete sprint details with issues and calculated progress metrics.
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.sprintsService.findOne(id);
  }

  /**
   * GET /api/sprints/:id/issues
   * Retrieve issues assigned to a specific sprint.
   */
  @Get(':id/issues')
  async getIssues(@Param('id') id: string) {
    return this.sprintsService.getSprintIssues(id);
  }

  /**
   * GET /api/sprints/:id/progress
   * Retrieve delivery metrics and story point progress for a sprint.
   */
  @Get(':id/progress')
  async getProgress(@Param('id') id: string) {
    return this.sprintsService.getSprintProgress(id);
  }

  /**
   * PATCH /api/sprints/:id
   * Update mutable sprint metadata (name, dates, goal).
   */
  @Patch(':id')
  @Roles(UserRole.Admin, UserRole.Project_Manager)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSprintDto,
    @CurrentUser() user: any,
  ) {
    const userId = user?.id || user?.sub;
    return this.sprintsService.update(id, dto, userId);
  }

  /**
   * POST /api/sprints/:id/start
   * Start a planned sprint and activate execution.
   */
  @Post(':id/start')
  @Roles(UserRole.Admin, UserRole.Project_Manager)
  @HttpCode(HttpStatus.OK)
  async start(@Param('id') id: string, @CurrentUser() user: any) {
    const userId = user?.id || user?.sub;
    return this.sprintsService.start(id, userId);
  }

  /**
   * POST /api/sprints/:id/complete
   * Complete active sprint and roll over unresolved tickets.
   */
  @Post(':id/complete')
  @Roles(UserRole.Admin, UserRole.Project_Manager)
  @HttpCode(HttpStatus.OK)
  async completePost(
    @Param('id') id: string,
    @Body() dto: CompleteSprintDto,
    @CurrentUser() user: any,
  ) {
    const userId = user?.id || user?.sub;
    return this.sprintsService.complete(id, dto, userId);
  }

  /**
   * PATCH /api/sprints/:id/complete
   * Alias route supporting PATCH /sprints/:id/complete convention.
   */
  @Patch(':id/complete')
  @Roles(UserRole.Admin, UserRole.Project_Manager)
  async completePatch(
    @Param('id') id: string,
    @Body() dto: CompleteSprintDto,
    @CurrentUser() user: any,
  ) {
    const userId = user?.id || user?.sub;
    return this.sprintsService.complete(id, dto, userId);
  }

  /**
   * DELETE /api/sprints/:id
   * Delete sprint. Unassigns contained issues to backlog.
   */
  @Delete(':id')
  @Roles(UserRole.Admin, UserRole.Project_Manager)
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    const userId = user?.id || user?.sub;
    return this.sprintsService.remove(id, userId);
  }
}
