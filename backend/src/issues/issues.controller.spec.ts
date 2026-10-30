import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { IssuesController } from './issues.controller.js';
import { IssuesService } from './issues.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { IssueStatus, Priority, SupportLevel, IssueType, UserRole } from '@prisma/client';

describe('IssuesController', () => {
  let controller: IssuesController;
  let service: IssuesService;

  const mockIssuesService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    escalate: vi.fn(),
    remove: vi.fn(),
  };




  const mockPrismaService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IssuesController],
      providers: [
        { provide: IssuesService, useValue: mockIssuesService },
        { provide: PrismaService, useValue: mockPrismaService },
        Reflector,
        RolesGuard,
      ],
    }).compile();

    controller = module.get<IssuesController>(IssuesController);
    service = module.get<IssuesService>(IssuesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  it('should create an issue', async () => {
    const dto = {
      projectId: 'proj-1',
      title: 'Test issue',
      type: IssueType.Bug,
      priority: Priority.High,
      supportLevel: SupportLevel.L1,
    };
    const expected = { id: 'INB-1001', ...dto };
    mockIssuesService.create.mockResolvedValue(expected);

    const result = await controller.create(dto as any, { id: 'user-1', role: UserRole.Admin });
    expect(result).toEqual(expected);
    expect(mockIssuesService.create).toHaveBeenCalledWith(dto, 'user-1');
  });

  it('should find all issues', async () => {
    const expected = { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
    mockIssuesService.findAll.mockResolvedValue(expected);

    const result = await controller.findAll({});
    expect(result).toEqual(expected);
    expect(mockIssuesService.findAll).toHaveBeenCalledWith({});
  });

  it('should find one issue by id', async () => {
    const expected = { id: 'INB-1001', title: 'Test issue' };
    mockIssuesService.findOne.mockResolvedValue(expected);

    const result = await controller.findOne('INB-1001');
    expect(result).toEqual(expected);
    expect(mockIssuesService.findOne).toHaveBeenCalledWith('INB-1001');
  });

  it('should update an issue status', async () => {
    const expected = { id: 'INB-1001', status: IssueStatus.In_Progress };
    mockIssuesService.updateStatus.mockResolvedValue(expected);

    const result = await controller.updateStatus('INB-1001', { status: IssueStatus.In_Progress }, { id: 'user-1' });
    expect(result).toEqual(expected);
    expect(mockIssuesService.updateStatus).toHaveBeenCalledWith('INB-1001', { status: IssueStatus.In_Progress }, 'user-1');
  });

  it('should escalate an issue', async () => {
    const escalateDto = { toLevel: SupportLevel.L2, reason: 'Escalation required for technical investigation' };
    const expected = { id: 'INB-1001', supportLevel: SupportLevel.L2, isEscalated: true };
    mockIssuesService.escalate.mockResolvedValue(expected);

    const result = await controller.escalate('INB-1001', escalateDto, { id: 'user-1' });
    expect(result).toEqual(expected);
    expect(mockIssuesService.escalate).toHaveBeenCalledWith('INB-1001', escalateDto, 'user-1');
  });

  it('should remove an issue', async () => {
    const expected = { success: true, deletedId: 'INB-1001' };
    mockIssuesService.remove.mockResolvedValue(expected);

    const result = await controller.remove('INB-1001');
    expect(result).toEqual(expected);
    expect(mockIssuesService.remove).toHaveBeenCalledWith('INB-1001');
  });
});
