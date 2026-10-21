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
import { UsersService, PaginatedUsersResponse } from './users.service';
import { SafeUser } from '../auth/auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/**
 * UsersController — REST API for /api/users
 *
 * All endpoints require a valid JWT (JwtAuthGuard applied at class level).
 * Role-restricted endpoints additionally apply RolesGuard via @Roles().
 *
 * RBAC Summary:
 *   GET  /users          — All authenticated roles
 *   GET  /users/:id      — All authenticated roles
 *   POST /users          — Admin only
 *   PATCH /users/:id     — Admin or Project_Manager (or self — enforced in service)
 *   DELETE /users/:id    — Admin only
 *   PATCH /users/:id/password — Admin (any user) or self (enforced in service)
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // --------------------------------------------------------------------------
  // GET /api/users
  // List all users with optional filtering, searching, and pagination.
  // All authenticated users may access this endpoint.
  // --------------------------------------------------------------------------
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryUsersDto): Promise<PaginatedUsersResponse> {
    return this.usersService.findAll(query);
  }

  // --------------------------------------------------------------------------
  // GET /api/users/:id
  // Retrieve a single user by CUID.
  // All authenticated users may access this endpoint.
  // --------------------------------------------------------------------------
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string): Promise<SafeUser> {
    return this.usersService.findOne(id);
  }

  // --------------------------------------------------------------------------
  // POST /api/users
  // Create a new user account.
  // Admin only — RolesGuard enforces this; Admin superuser bypass is built-in.
  // --------------------------------------------------------------------------
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateUserDto): Promise<SafeUser> {
    return this.usersService.create(dto);
  }

  // --------------------------------------------------------------------------
  // PATCH /api/users/:id
  // Update user profile fields.
  // Admin or Project_Manager can update any user.
  // Other authenticated users can update ONLY their own profile (enforced in service).
  // --------------------------------------------------------------------------
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() currentUser: any,
  ): Promise<SafeUser> {
    return this.usersService.update(id, dto, currentUser);
  }

  // --------------------------------------------------------------------------
  // DELETE /api/users/:id
  // Permanently delete a user account.
  // Admin only — RolesGuard enforces this.
  // Service additionally prevents self-delete and last-Admin deletion.
  // --------------------------------------------------------------------------
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: any,
  ): Promise<{ message: string }> {
    return this.usersService.remove(id, currentUser);
  }

  // --------------------------------------------------------------------------
  // PATCH /api/users/:id/password
  // Change or reset a user's password.
  // Admin: can reset any user's password (newPassword only required).
  // Non-Admin: can change only their own password (currentPassword required).
  // Authorization is enforced in the service layer.
  // --------------------------------------------------------------------------
  @Patch(':id/password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Param('id') id: string,
    @Body() dto: ChangePasswordDto,
    @CurrentUser() currentUser: any,
  ): Promise<{ message: string }> {
    return this.usersService.changePassword(id, dto, currentUser);
  }
}
