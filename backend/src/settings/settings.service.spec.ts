import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService, DEFAULT_SETTINGS } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      settings: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSettings', () => {
    it('should return existing singleton settings if present', async () => {
      prisma.settings.findUnique.mockResolvedValue({
        id: 'singleton',
        appName: 'Custom Desk',
      });

      const result = await service.getSettings();

      expect(prisma.settings.findUnique).toHaveBeenCalledWith({ where: { id: 'singleton' } });
      expect(result.appName).toBe('Custom Desk');
      expect(prisma.settings.create).not.toHaveBeenCalled();
    });

    it('should seed default settings if record does not exist', async () => {
      prisma.settings.findUnique.mockResolvedValue(null);
      prisma.settings.create.mockResolvedValue(DEFAULT_SETTINGS);

      const result = await service.getSettings();

      expect(prisma.settings.create).toHaveBeenCalledWith({ data: DEFAULT_SETTINGS });
      expect(result).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('updateSettings', () => {
    it('should update workspace settings', async () => {
      prisma.settings.findUnique.mockResolvedValue(DEFAULT_SETTINGS);
      prisma.settings.update.mockResolvedValue({
        ...DEFAULT_SETTINGS,
        appName: 'Enterprise Portal',
        theme: 'dark',
      });

      const updateDto = { appName: 'Enterprise Portal', theme: 'dark' };
      const result = await service.updateSettings(updateDto);

      expect(prisma.settings.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'singleton' },
          data: expect.objectContaining({
            appName: 'Enterprise Portal',
            theme: 'dark',
          }),
        }),
      );
      expect(result.appName).toBe('Enterprise Portal');
      expect(result.theme).toBe('dark');
    });
  });

  describe('resetSettings', () => {
    it('should reset workspace settings to defaults', async () => {
      prisma.settings.findUnique.mockResolvedValue({
        id: 'singleton',
        appName: 'Modified App',
      });
      prisma.settings.update.mockResolvedValue(DEFAULT_SETTINGS);

      const result = await service.resetSettings();

      expect(prisma.settings.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'singleton' },
          data: expect.objectContaining({
            appName: DEFAULT_SETTINGS.appName,
            workspaceName: DEFAULT_SETTINGS.workspaceName,
          }),
        }),
      );
      expect(result).toEqual(DEFAULT_SETTINGS);
    });
  });
});

