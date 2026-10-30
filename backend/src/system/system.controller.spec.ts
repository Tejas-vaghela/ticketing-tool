import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SystemController } from './system.controller.js';
import { SystemService } from './system.service.js';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { ServiceUnavailableException } from '@nestjs/common';
import { SystemHealthResponseDto } from './dto/system-health.dto.js';

describe('SystemController', () => {
  let controller: SystemController;
  let service: SystemService;

  const mockSystemService = {
    getHealth: vi.fn(),
    getInfo: vi.fn(),
    exportDatabase: vi.fn(),
    importDatabase: vi.fn(),
    resetToFactorySeed: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SystemController],
      providers: [
        { provide: SystemService, useValue: mockSystemService },
        Reflector,
        RolesGuard,
      ],
    }).compile();

    controller = module.get<SystemController>(SystemController);
    service = module.get<SystemService>(SystemService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return health status when healthy', async () => {
      const mockHealth: SystemHealthResponseDto = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: 100,
        services: {
          database: { status: 'up', latencyMs: 2.5 },
          application: { status: 'up', memoryUsageMb: 85 },
        },
      };

      mockSystemService.getHealth.mockResolvedValue(mockHealth);

      const res = await controller.getHealth();

      expect(res).toEqual(mockHealth);
      expect(mockSystemService.getHealth).toHaveBeenCalled();
    });

    it('should throw ServiceUnavailableException when health status is error', async () => {
      const mockHealth: SystemHealthResponseDto = {
        status: 'error',
        timestamp: new Date().toISOString(),
        uptime: 100,
        services: {
          database: { status: 'down', error: 'DB down' },
          application: { status: 'up', memoryUsageMb: 85 },
        },
      };

      mockSystemService.getHealth.mockResolvedValue(mockHealth);

      await expect(controller.getHealth()).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('getInfo', () => {
    it('should call systemService.getInfo', async () => {
      const mockInfo = { success: true, data: {} };
      mockSystemService.getInfo.mockResolvedValue(mockInfo);

      const res = await controller.getInfo();

      expect(res).toEqual(mockInfo);
      expect(mockSystemService.getInfo).toHaveBeenCalled();
    });
  });

  describe('exportDatabase', () => {
    it('should call systemService.exportDatabase with admin user id', async () => {
      const mockExport = { version: '1.0.0', recordCounts: {}, data: {} };
      mockSystemService.exportDatabase.mockResolvedValue(mockExport);

      const res = await controller.exportDatabase({ id: 'admin-1', role: 'Admin' });

      expect(res).toEqual(mockExport);
      expect(mockSystemService.exportDatabase).toHaveBeenCalledWith('admin-1');
    });
  });

  describe('importDatabase', () => {
    it('should call systemService.importDatabase with DTO and admin user id', async () => {
      const dto = { version: '1.0.0', data: {} };
      const mockImportRes = { success: true, message: 'Restored' };
      mockSystemService.importDatabase.mockResolvedValue(mockImportRes);

      const res = await controller.importDatabase(dto, { id: 'admin-1', role: 'Admin' });

      expect(res).toEqual(mockImportRes);
      expect(mockSystemService.importDatabase).toHaveBeenCalledWith(dto, 'admin-1');
    });
  });

  describe('resetDatabase', () => {
    it('should call systemService.resetToFactorySeed with admin user id', async () => {
      const mockResetRes = { success: true, message: 'Reset complete' };
      mockSystemService.resetToFactorySeed.mockResolvedValue(mockResetRes);

      const res = await controller.resetDatabase({ id: 'admin-1', role: 'Admin' });

      expect(res).toEqual(mockResetRes);
      expect(mockSystemService.resetToFactorySeed).toHaveBeenCalledWith('admin-1');
    });
  });
});
