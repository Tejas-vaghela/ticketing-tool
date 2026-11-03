import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';

export const DEFAULT_SETTINGS = {
  id: 'singleton',
  appName: 'Inbox',
  tagline: 'Work organized. Teams aligned.',
  workspaceName: 'Acme Global Workspace',
  theme: 'light',
  notificationsEnabled: true,
  slaSettings: {
    l1ResponseHours: 4,
    l1ResolutionHours: 24,
    l2ResponseHours: 2,
    l2ResolutionHours: 12,
    l3ResponseHours: 1,
    l3ResolutionHours: 6,
    warningThresholdHours: 2,
  },
  notifications: {
    issueAssigned: true,
    commentAdded: true,
    statusChanged: true,
    mention: true,
    sprintStarted: true,
    sprintCompleted: true,
  },
  preferences: {
    defaultIssueView: 'table',
    defaultProjectId: 'proj-1',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: '12-hour',
  },
  slaRules: {
    Highest: { responseHours: 0.5, resolutionHours: 4 },
    High: { responseHours: 1, resolutionHours: 8 },
    Medium: { responseHours: 4, resolutionHours: 24 },
    Low: { responseHours: 8, resolutionHours: 48 },
    Lowest: { responseHours: 8, resolutionHours: 48 },
  },
  rolePageAccess: {},
};

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves workspace settings. If no row exists yet, seeds the default record.
   */
  async getSettings() {
    let settings = await this.prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    if (!settings) {
      this.logger.log('Initializing singleton workspace settings with defaults');
      settings = await this.prisma.settings.create({
        data: DEFAULT_SETTINGS,
      });
    }

    return settings;
  }

  /**
   * Updates workspace settings.
   */
  async updateSettings(dto: UpdateSettingsDto) {
    // Ensure settings record exists first
    await this.getSettings();

    const updated = await this.prisma.settings.update({
      where: { id: 'singleton' },
      data: {
        ...(dto.appName !== undefined && { appName: dto.appName }),
        ...(dto.tagline !== undefined && { tagline: dto.tagline }),
        ...(dto.workspaceName !== undefined && { workspaceName: dto.workspaceName }),
        ...(dto.theme !== undefined && { theme: dto.theme }),
        ...(dto.notificationsEnabled !== undefined && { notificationsEnabled: dto.notificationsEnabled }),
        ...(dto.slaSettings !== undefined && { slaSettings: dto.slaSettings }),
        ...(dto.notifications !== undefined && { notifications: dto.notifications }),
        ...(dto.preferences !== undefined && { preferences: dto.preferences }),
        ...(dto.slaRules !== undefined && { slaRules: dto.slaRules }),
        ...(dto.rolePageAccess !== undefined && { rolePageAccess: dto.rolePageAccess }),
      },
    });

    return updated;
  }
}
