import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SettingsService } from './settings.service.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '@prisma/client';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * GET /api/settings
   * Retrieve workspace settings.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getSettings() {
    return this.settingsService.getSettings();
  }

  /**
   * PATCH /api/settings
   * Update workspace settings. Admin or Project Manager role required.
   */
  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.Project_Manager)
  @HttpCode(HttpStatus.OK)
  async updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(dto);
  }

  /**
   * POST /api/settings/reset
   * Reset workspace settings to defaults. Admin or Project Manager role required.
   */
  @Post('reset')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.Project_Manager)
  @HttpCode(HttpStatus.OK)
  async resetSettings() {
    return this.settingsService.resetSettings();
  }
}

