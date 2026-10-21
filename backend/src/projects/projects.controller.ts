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
import { ProjectsService, ProjectListItem, ProjectDetailItem } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

/**
 * ProjectsController — REST API for /api/projects
 *
 * All endpoints require a valid JWT (JwtAuthGuard applied at class level).
 * Role-restricted endpoints additionally apply RolesGuard via @Roles().
 *
 * RBAC Summary:
 *   GET    /projects         — All authenticated roles
 *   GET    /projects/:id     — All authenticated roles
 *   POST   /projects         — Admin, Project_Manager
 *   PATCH  /projects/:id     — Admin, Project_Manager
 *   DELETE /projects/:id     — Admin only
 */
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // --------------------------------------------------------------------------
  // GET /api/projects
  // List all projects with optional filtering, searching, and pagination.
  // --------------------------------------------------------------------------
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryProjectsDto): Promise<ProjectListItem[]> {
    return this.projectsService.findAll(query);
  }

  // --------------------------------------------------------------------------
  // GET /api/projects/:id
  // Retrieve a single project cockpit by CUID or Key.
  // --------------------------------------------------------------------------
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string): Promise<ProjectDetailItem> {
    return this.projectsService.findOne(id);
  }

  // --------------------------------------------------------------------------
  // POST /api/projects
  // Create a new project repository.
  // Admin and Project_Manager only.
  // --------------------------------------------------------------------------
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin, UserRole.Project_Manager)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProjectDto): Promise<any> {
    return this.projectsService.create(dto);
  }

  // --------------------------------------------------------------------------
  // PATCH /api/projects/:id
  // Update project metadata and member assignments.
  // Admin and Project_Manager only.
  // --------------------------------------------------------------------------
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin, UserRole.Project_Manager)
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<any> {
    return this.projectsService.update(id, dto);
  }

  // --------------------------------------------------------------------------
  // DELETE /api/projects/:id
  // Permanently delete a project and cascade child data.
  // Admin only.
  // --------------------------------------------------------------------------
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.projectsService.remove(id);
  }
}
