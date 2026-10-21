import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SafeUser } from '../auth/auth.service';
import { UserRole, Prisma } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { QueryUsersDto } from './dto/query-users.dto';

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const SALT_ROUNDS = 10;

/**
 * Prisma select clause that always excludes the password field.
 * This is the authoritative SafeUser projection used across all UsersService methods.
 */
const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  department: true,
  supportLevels: true,
  avatar: true,
  timezone: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

// --------------------------------------------------------------------------
// Response Types
// --------------------------------------------------------------------------

export interface PaginatedUsersResponse {
  data: SafeUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// --------------------------------------------------------------------------
// UsersService
// --------------------------------------------------------------------------

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // --------------------------------------------------------------------------
  // Password utilities
  // --------------------------------------------------------------------------

  private async hashPassword(plaintext: string): Promise<string> {
    return bcrypt.hash(plaintext, SALT_ROUNDS);
  }

  private async verifyPassword(plaintext: string, hash: string): Promise<boolean> {
    // Support legacy plaintext passwords from the auth service seed fallback
    if (hash.startsWith('$2b$') || hash.startsWith('$2a$')) {
      return bcrypt.compare(plaintext, hash);
    }
    return hash === plaintext;
  }

  // --------------------------------------------------------------------------
  // findAll — GET /api/users
  // --------------------------------------------------------------------------

  async findAll(query: QueryUsersDto): Promise<PaginatedUsersResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    // Build Prisma where clause dynamically
    const where: Prisma.UserWhereInput = {};

    if (query.role) {
      where.role = { equals: query.role };
    }

    if (query.status) {
      where.status = { equals: query.status };
    }

    if (query.supportLevel) {
      where.supportLevels = { has: query.supportLevel };
    }

    if (query.department) {
      where.department = { contains: query.department, mode: 'insensitive' };
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Execute count + findMany in a single transaction for consistency
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: safeUserSelect,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: data as SafeUser[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // --------------------------------------------------------------------------
  // findOne — GET /api/users/:id
  // --------------------------------------------------------------------------

  async findOne(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: safeUserSelect,
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    return user as SafeUser;
  }

  // --------------------------------------------------------------------------
  // create — POST /api/users  (Admin only)
  // --------------------------------------------------------------------------

  async create(dto: CreateUserDto): Promise<SafeUser> {
    const hashedPassword = await this.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase().trim(),
        password: hashedPassword,
        role: dto.role ?? UserRole.Viewer,
        department: dto.department,
        supportLevels: dto.supportLevels ?? ['L1'],
        avatar: dto.avatar ?? '',
        timezone: dto.timezone ?? 'UTC',
        status: dto.status ?? 'Active',
      },
      select: safeUserSelect,
    });

    this.logger.log(`User created: ${user.email} (role: ${user.role})`);
    return user as SafeUser;
  }

  // --------------------------------------------------------------------------
  // update — PATCH /api/users/:id
  // --------------------------------------------------------------------------

  async update(
    id: string,
    dto: UpdateUserDto,
    currentUser: { id?: string; sub?: string; role: string },
  ): Promise<SafeUser> {
    const callerId = currentUser.id || currentUser.sub;
    const callerRole = currentUser.role;

    // Verify target user exists
    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    // Authorization:
    // - Admin can update anyone (superuser, bypasses all checks)
    // - Project_Manager can update anyone
    // - Others can only update themselves
    const isAdminOrPM =
      callerRole === UserRole.Admin || callerRole === UserRole.Project_Manager;

    if (!isAdminOrPM && callerId !== id) {
      throw new ForbiddenException('You are not authorized to update another user\'s profile.');
    }

    // Prevent role escalation: non-Admin cannot assign Admin role to any user
    if (dto.role === UserRole.Admin && callerRole !== UserRole.Admin) {
      throw new ForbiddenException('Only an Admin can assign the Admin role.');
    }

    // Non-Admin/PM callers (self-update) cannot change their own role at all
    // They may update permitted profile fields only. Role change is blocked for non-admins.
    if (!isAdminOrPM && dto.role !== undefined) {
      throw new ForbiddenException('You are not authorized to change your own role.');
    }

    // Build the update data — only include provided fields
    const updateData: Prisma.UserUpdateInput = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.email !== undefined) updateData.email = dto.email.toLowerCase().trim();
    if (dto.department !== undefined) updateData.department = dto.department;
    if (dto.supportLevels !== undefined) updateData.supportLevels = { set: dto.supportLevels };
    if (dto.avatar !== undefined) updateData.avatar = dto.avatar;
    if (dto.timezone !== undefined) updateData.timezone = dto.timezone;
    if (dto.status !== undefined) updateData.status = dto.status;

    // Only Admin/PM can change roles (and Admin role already blocked above for non-Admin)
    if (dto.role !== undefined && isAdminOrPM) {
      updateData.role = dto.role;
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: safeUserSelect,
    });

    this.logger.log(`User updated: ${id} by caller ${callerId}`);
    return updated as SafeUser;
  }

  // --------------------------------------------------------------------------
  // remove — DELETE /api/users/:id  (Admin only)
  // --------------------------------------------------------------------------

  async remove(
    id: string,
    currentUser: { id?: string; sub?: string; role: string },
  ): Promise<{ message: string }> {
    const callerId = currentUser.id || currentUser.sub;

    // Verify target user exists
    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    // Prevent self-deletion
    if (callerId === id) {
      throw new BadRequestException('You cannot delete your own account.');
    }

    // Prevent deleting the last active Admin account
    if (targetUser.role === UserRole.Admin) {
      const adminCount = await this.prisma.user.count({
        where: { role: UserRole.Admin },
      });
      if (adminCount <= 1) {
        throw new BadRequestException(
          'Cannot delete the last Admin account. Assign the Admin role to another user first.',
        );
      }
    }

    // Pre-check: prevent deletion if the user is a project lead (would trigger P2003)
    const ledProjectCount = await this.prisma.project.count({
      where: { leadId: id },
    });
    if (ledProjectCount > 0) {
      throw new BadRequestException(
        `Cannot delete user ${id}: they are the lead of ${ledProjectCount} project(s). ` +
          'Reassign or remove those projects first.',
      );
    }

    // Pre-check: prevent deletion if the user has reported issues
    const reportedIssuesCount = await this.prisma.issue.count({
      where: { reporterId: id },
    });
    if (reportedIssuesCount > 0) {
      throw new BadRequestException(
        `Cannot delete user ${id}: they are the reporter of ${reportedIssuesCount} issue(s). ` +
          'Reassign or remove those issues first.',
      );
    }

    // Pre-check: prevent deletion if the user has authored comments
    const commentCount = await this.prisma.comment.count({
      where: { authorId: id },
    });
    if (commentCount > 0) {
      throw new BadRequestException(
        `Cannot delete user ${id}: they are the author of ${commentCount} comment(s). ` +
          'Remove or reassign those comments first.',
      );
    }

    // Hard delete — Prisma will cascade Notifications and SavedFilters,
    // and SET NULL on assignedIssues and escalatedAssignments per schema.
    await this.prisma.user.delete({ where: { id } });

    this.logger.log(`User deleted: ${id} by caller ${callerId}`);
    return { message: `User ${id} has been permanently deleted.` };
  }

  // --------------------------------------------------------------------------
  // changePassword — PATCH /api/users/:id/password
  // --------------------------------------------------------------------------

  async changePassword(
    id: string,
    dto: ChangePasswordDto,
    currentUser: { id?: string; sub?: string; role: string },
  ): Promise<{ message: string }> {
    const callerId = currentUser.id || currentUser.sub;
    const callerRole = currentUser.role;
    const isAdmin = callerRole === UserRole.Admin;

    // Validate confirmPassword matches newPassword if provided
    if (dto.confirmPassword !== undefined && dto.confirmPassword !== dto.newPassword) {
      throw new BadRequestException('Passwords do not match.');
    }

    // Fetch the full user record (including password hash) for verification
    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    // Authorization: non-Admin can only change their own password
    if (!isAdmin && callerId !== id) {
      throw new ForbiddenException('You are not authorized to reset another user\'s password.');
    }

    // Self-service path: currentPassword MUST be verified
    if (!isAdmin || (callerId === id && dto.currentPassword !== undefined)) {
      if (!dto.currentPassword) {
        throw new BadRequestException(
          'currentPassword is required to change your own password.',
        );
      }
      const isMatch = await this.verifyPassword(dto.currentPassword, targetUser.password);
      if (!isMatch) {
        throw new BadRequestException('Current password is incorrect.');
      }
    }

    // Hash and store the new password — NEVER log or return the hash
    const newHash = await this.hashPassword(dto.newPassword);
    await this.prisma.user.update({
      where: { id },
      data: { password: newHash },
    });

    this.logger.log(`Password changed for user: ${id} by caller ${callerId}`);
    // Note: JWT tokens are stateless; existing tokens remain valid until expiration.
    // Token invalidation is not implemented in the current stateless JWT architecture.
    return { message: 'Password updated successfully.' };
  }
}
