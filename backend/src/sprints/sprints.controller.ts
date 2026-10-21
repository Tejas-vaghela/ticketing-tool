import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SprintsService, SprintListItem, CompleteSprintResult } from './sprints.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { CompleteSprintDto } from './dto/complete-sprint.dto';
import { QuerySprintsDto } from './dto/query-sprints.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/**
 * SprintsController — REST API for /api/sprints
 *
 * All endpoints require a valid JWT (JwtAuthGuard applied at class level).
 * Role-restricted endpoints additionally apply RolesGuard via @Roles().
 *
 * RBAC Summary:
 *   GET    /sprints             — All authenticated roles
 *   POST   /sprints             — Admin, Project_Manager
 *   PATCH  /sprints/:id         — Admin, Project_Manager
 *   POST   /sprints/:id/start   — Admin, Project_Manager
 *   POST   /sprints/:id/complete— Admin, Project_Manager
 *   DELETE /sprints/:id         — Admin, Project_Manager
 */
@Controller('sprints')
@UseGuards(JwtAuthGuard)
export class SprintsController {
  constructor(private readonly sprintsService: SprintsService) {}

  // --------------------------------------------------------------------------
  // GET /api/sprints
  // List all sprints for a project with optional status filter.
  // --------------------------------------------------------------------------
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QuerySprintsDto): Promise<SprintListItem[]> {
    return this.sprintsService.findAll(query);
  }

  // --------------------------------------------------------------------------
  // POST /api/sprints
  // Create a new planned sprint.
  // --------------------------------------------------------------------------
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin, UserRole.Project_Manager)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateSprintDto,
    @CurrentUser() user: any,
  ): Promise<any> {
    return this.sprintsService.create(dto, user);
  }

  // --------------------------------------------------------------------------
  // PATCH /api/sprints/:id
  // Update sprint name, goal, or dates.
  // --------------------------------------------------------------------------
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin, UserRole.Project_Manager)
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSprintDto,
    @CurrentUser() user: any,
  ): Promise<any> {
    return this.sprintsService.update(id, dto, user);
  }

  // --------------------------------------------------------------------------
  // POST /api/sprints/:id/start
  // Start a planned sprint (enforces single active sprint per project).
  // --------------------------------------------------------------------------
  @Post(':id/start')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin, UserRole.Project_Manager)
  @HttpCode(HttpStatus.OK)
  async start(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<any> {
    return this.sprintsService.start(id, user);
  }

  // --------------------------------------------------------------------------
  // POST /api/sprints/:id/complete
  // Complete active sprint and roll over unresolved tickets.
  // --------------------------------------------------------------------------
  @Post(':id/complete')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin, UserRole.Project_Manager)
  @HttpCode(HttpStatus.OK)
  async complete(
    @Param('id') id: string,
    @Body() dto: CompleteSprintDto,
    @CurrentUser() user: any,
  ): Promise<CompleteSprintResult> {
    return this.sprintsService.complete(id, dto, user);
  }

  // --------------------------------------------------------------------------
  // DELETE /api/sprints/:id
  // Remove sprint; unassigns attached issues to Backlog.
  // --------------------------------------------------------------------------
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin, UserRole.Project_Manager)
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean; id: string; message: string }> {
    return this.sprintsService.remove(id, user);
  }
}
