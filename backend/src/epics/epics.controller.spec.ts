import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { EpicsController } from './epics.controller.js';
import { EpicsService } from './epics.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { EpicStatus, UserRole } from '@prisma/client';

describe('EpicsController', () => {
  let controller: EpicsController;
  let service: EpicsService;

  const mockEpicsService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    findByProject: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    getEpicIssues: vi.fn(),
    assignIssue: vi.fn(),
    removeIssue: vi.fn(),
  };

  const mockPrismaService = {};

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EpicsController],
      providers: [
        { provide: EpicsService, useValue: mockEpicsService },
        { provide: PrismaService, useValue: mockPrismaService },
        Reflector,
        RolesGuard,
      ],
    }).compile();

    controller = module.get<EpicsController>(EpicsController);
    service = module.get<EpicsService>(EpicsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  it('should create an epic', async () => {
    const dto = {
      projectId: 'proj-1',
      name: 'Customer Onboarding',
      description: 'Onboarding flows',
      color: '#3b82f6',
      status: EpicStatus.To_Do,
    };
    const expected = { id: 'epic-1', ...dto };
    mockEpicsService.create.mockResolvedValue(expected);

    const result = await controller.create(dto as any, { id: 'user-1', role: UserRole.Admin });
    expect(result).toEqual(expected);
    expect(mockEpicsService.create).toHaveBeenCalledWith(dto, 'user-1');
  });

  it('should list all epics with query filters', async () => {
    const epics = [{ id: 'epic-1', name: 'Customer Onboarding' }];
    mockEpicsService.findAll.mockResolvedValue(epics);

    const result = await controller.findAll({ projectId: 'proj-1' });
    expect(result).toEqual(epics);
    expect(mockEpicsService.findAll).toHaveBeenCalledWith({ projectId: 'proj-1' });
  });

  it('should find epic by ID', async () => {
    const epic = { id: 'epic-1', name: 'Customer Onboarding', issues: [] };
    mockEpicsService.findOne.mockResolvedValue(epic);

    const result = await controller.findOne('epic-1');
    expect(result).toEqual(epic);
    expect(mockEpicsService.findOne).toHaveBeenCalledWith('epic-1');
  });

  it('should retrieve issues for an epic', async () => {
    const issues = [{ id: 'INB-1001', title: 'Test issue' }];
    mockEpicsService.getEpicIssues.mockResolvedValue(issues);

    const result = await controller.getIssues('epic-1');
    expect(result).toEqual(issues);
    expect(mockEpicsService.getEpicIssues).toHaveBeenCalledWith('epic-1');
  });

  it('should update an epic', async () => {
    const updateDto = { name: 'Customer Onboarding Updated' };
    const updated = { id: 'epic-1', name: 'Customer Onboarding Updated' };
    mockEpicsService.update.mockResolvedValue(updated);

    const result = await controller.update('epic-1', updateDto, { id: 'user-1' });
    expect(result).toEqual(updated);
    expect(mockEpicsService.update).toHaveBeenCalledWith('epic-1', updateDto, 'user-1');
  });

  it('should delete an epic', async () => {
    const response = { success: true, message: 'Epic deleted' };
    mockEpicsService.remove.mockResolvedValue(response);

    const result = await controller.remove('epic-1', { id: 'user-1' });
    expect(result).toEqual(response);
    expect(mockEpicsService.remove).toHaveBeenCalledWith('epic-1', 'user-1');
  });

  it('should assign an issue to an epic', async () => {
    const response = { id: 'INB-1001', epicId: 'epic-1' };
    mockEpicsService.assignIssue.mockResolvedValue(response);

    const result = await controller.assignIssue('epic-1', 'INB-1001', { id: 'user-1' });
    expect(result).toEqual(response);
    expect(mockEpicsService.assignIssue).toHaveBeenCalledWith('epic-1', 'INB-1001', 'user-1');
  });

  it('should remove an issue from an epic', async () => {
    const response = { id: 'INB-1001', epicId: null };
    mockEpicsService.removeIssue.mockResolvedValue(response);

    const result = await controller.removeIssue('epic-1', 'INB-1001', { id: 'user-1' });
    expect(result).toEqual(response);
    expect(mockEpicsService.removeIssue).toHaveBeenCalledWith('epic-1', 'INB-1001', 'user-1');
  });
});
