import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SystemService } from './system.service.js';
import { ImportSystemDto } from './dto/import-system.dto.js';
import { SystemHealthResponseDto } from './dto/system-health.dto.js';
import { SystemInfoResponseDto } from './dto/system-info.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserRole } from '@prisma/client';

@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  /**
   * GET /api/system/health
   * Public readiness and liveness probe. Verifies application uptime and PostgreSQL connectivity.
   * Returns 200 OK if healthy, or 503 Service Unavailable if database connection fails.
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async getHealth(): Promise<SystemHealthResponseDto> {
    const health = await this.systemService.getHealth();
    if (health.status === 'error') {
      throw new ServiceUnavailableException(health);
    }
    return health;
  }

  /**
   * GET /api/system/info
   * Returns safe, sanitized runtime telemetry and environment metadata.
   * Requires JWT authentication.
   */
  @Get('info')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getInfo(): Promise<SystemInfoResponseDto> {
    return this.systemService.getInfo();
  }

  /**
   * GET /api/system/export
   * Generates a complete JSON database snapshot dump.
   * Restricted strictly to Admin users.
   */
  @Get('export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.OK)
  async exportDatabase(@CurrentUser() user?: any) {
    const adminUserId = user?.id || user?.sub;
    return this.systemService.exportDatabase(adminUserId);
  }

  /**
   * POST /api/system/import
   * Restores relational database state from a validated JSON backup snapshot.
   * Restricted strictly to Admin users. Executed inside an atomic transaction.
   */
  @Post('import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.OK)
  async importDatabase(
    @Body() dto: ImportSystemDto,
    @CurrentUser() user?: any,
  ) {
    const adminUserId = user?.id || user?.sub;
    return this.systemService.importDatabase(dto, adminUserId);
  }

  /**
   * POST /api/system/reset
   * Wipes operational database tables and restores initial factory seed data.
   * Restricted strictly to Admin users. Executed inside an atomic transaction.
   */
  @Post('reset')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  @HttpCode(HttpStatus.OK)
  async resetDatabase(@CurrentUser() user?: any) {
    const adminUserId = user?.id || user?.sub;
    return this.systemService.resetToFactorySeed(adminUserId);
  }
}
