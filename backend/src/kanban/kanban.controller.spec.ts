



import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { KanbanController } from './kanban.controller.js';
import { KanbanService } from './kanban.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { IssueStatus } from '@prisma/client';

describe('KanbanController', () => {
  let controller: KanbanController;
  let service: KanbanService;

  const mockKanbanService = {
    getColumns: vi.fn(),
    getBoard: vi.fn(),
    getIssue: vi.fn(),
    updateStatus: vi.fn(),
    moveIssue: vi.fn(),
  };

  const mockPrismaService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KanbanController],
      providers: [
        { provide: KanbanService, useValue: mockKanbanService },
        { provide: PrismaService, useValue: mockPrismaService },
        Reflector,
        RolesGuard,
      ],
    }).compile();

    controller = module.get<KanbanController>(KanbanController);
    service = module.get<KanbanService>(KanbanService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  it('should return board workflow columns', () => {
    const columns = [
      { id: 'To Do', dbStatus: IssueStatus.To_Do, title: 'To Do', color: 'border-slate-300', order: 1 },
      { id: 'In Progress', dbStatus: IssueStatus.In_Progress, title: 'In Progress', color: 'border-indigo-400', order: 2 },
    ];
    mockKanbanService.getColumns.mockReturnValue(columns);

    const result = controller.getColumns();
    expect(result).toEqual(columns);
    expect(mockKanbanService.getColumns).toHaveBeenCalled();
  });

  it('should fetch board data', async () => {
    const expected = {
      columns: [],
      issues: [],
      groupedIssues: {},
      totalCount: 0,
      page: 1,
      limit: 200,
    };
    mockKanbanService.getBoard.mockResolvedValue(expected);

    const result = await controller.getBoard({}, { id: 'user-1' });
    expect(result).toEqual(expected);
    expect(mockKanbanService.getBoard).toHaveBeenCalledWith({}, 'user-1');
  });

  it('should update issue status', async () => {
    const expected = { id: 'INB-1001', status: IssueStatus.In_Progress };
    mockKanbanService.updateStatus.mockResolvedValue(expected);

    const result = await controller.updateStatus(
      'INB-1001',
      { status: IssueStatus.In_Progress },
      { id: 'user-1' },
    );
    expect(result).toEqual(expected);
    expect(mockKanbanService.updateStatus).toHaveBeenCalledWith(
      'INB-1001',
      { status: IssueStatus.In_Progress },
      'user-1',
    );
  });

  it('should move issue to target column/sprint', async () => {
    const expected = { id: 'INB-1001', status: IssueStatus.Testing };
    mockKanbanService.moveIssue.mockResolvedValue(expected);

    const result = await controller.moveIssue(
      'INB-1001',
      { status: IssueStatus.Testing },
      { id: 'user-1' },
    );
    expect(result).toEqual(expected);
    expect(mockKanbanService.moveIssue).toHaveBeenCalledWith(
      'INB-1001',
      { status: IssueStatus.Testing },
      'user-1',
    );
  });

  it('should retrieve single issue details', async () => {
    const expected = { id: 'INB-1001', title: 'Test Kanban Issue' };
    mockKanbanService.getIssue.mockResolvedValue(expected);

    const result = await controller.getIssue('INB-1001');
    expect(result).toEqual(expected);
    expect(mockKanbanService.getIssue).toHaveBeenCalledWith('INB-1001');
  });
});

