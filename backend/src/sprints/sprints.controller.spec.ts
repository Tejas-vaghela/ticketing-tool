const vi = jest;
import { Test, TestingModule } from '@nestjs/testing';
import { SprintsController } from './sprints.controller.js';
import { SprintsService } from './sprints.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { SprintStatus, UserRole } from '@prisma/client';

describe('SprintsController', () => {
  let controller: SprintsController;
  let service: SprintsService;

  const mockSprintsService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    findByProject: vi.fn(),
    update: vi.fn(),
    start: vi.fn(),
    complete: vi.fn(),
    remove: vi.fn(),
    getSprintIssues: vi.fn(),
    getSprintProgress: vi.fn(),
  };

  const mockPrismaService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SprintsController],
      providers: [
        { provide: SprintsService, useValue: mockSprintsService },
        { provide: PrismaService, useValue: mockPrismaService },
        Reflector,
        RolesGuard,
      ],
    }).compile();

    controller = module.get<SprintsController>(SprintsController);
    service = module.get<SprintsService>(SprintsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  it('should create a sprint', async () => {
    const dto = {
      projectId: 'proj-1',
      name: 'Sprint 10',
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-15T00:00:00.000Z',
      goal: 'Deliver sprint tests',
    };
    const expected = { id: 'sprint-10', ...dto, status: SprintStatus.planned };
    mockSprintsService.create.mockResolvedValue(expected);

    const result = await controller.create(dto as any, { id: 'user-1', role: UserRole.Admin });
    expect(result).toEqual(expected);
    expect(mockSprintsService.create).toHaveBeenCalledWith(dto, 'user-1');
  });

  it('should list all sprints with filters', async () => {
    const sprints = [{ id: 'sprint-1', name: 'Sprint 1' }];
    mockSprintsService.findAll.mockResolvedValue(sprints);

    const result = await controller.findAll({ projectId: 'proj-1' });
    expect(result).toEqual(sprints);
    expect(mockSprintsService.findAll).toHaveBeenCalledWith({ projectId: 'proj-1' });
  });

  it('should find sprint by ID', async () => {
    const sprint = { id: 'sprint-1', name: 'Sprint 1', issues: [] };
    mockSprintsService.findOne.mockResolvedValue(sprint);

    const result = await controller.findOne('sprint-1');
    expect(result).toEqual(sprint);
    expect(mockSprintsService.findOne).toHaveBeenCalledWith('sprint-1');
  });

  it('should update a sprint', async () => {
    const updateDto = { name: 'Sprint 1 Updated' };
    const updated = { id: 'sprint-1', name: 'Sprint 1 Updated' };
    mockSprintsService.update.mockResolvedValue(updated);

    const result = await controller.update('sprint-1', updateDto, { id: 'user-1' });
    expect(result).toEqual(updated);
    expect(mockSprintsService.update).toHaveBeenCalledWith('sprint-1', updateDto, 'user-1');
  });

  it('should start a sprint', async () => {
    const active = { id: 'sprint-1', status: SprintStatus.active };
    mockSprintsService.start.mockResolvedValue(active);

    const result = await controller.start('sprint-1', { id: 'user-1' });
    expect(result).toEqual(active);
    expect(mockSprintsService.start).toHaveBeenCalledWith('sprint-1', 'user-1');
  });

  it('should complete a sprint', async () => {
    const completeDto = { targetSprintId: 'sprint-2' };
    const response = { sprint: { id: 'sprint-1', status: SprintStatus.completed }, rolledOverIssuesCount: 2 };
    mockSprintsService.complete.mockResolvedValue(response);

    const result = await controller.completePost('sprint-1', completeDto, { id: 'user-1' });
    expect(result).toEqual(response);
    expect(mockSprintsService.complete).toHaveBeenCalledWith('sprint-1', completeDto, 'user-1');
  });

  it('should delete a sprint', async () => {
    const response = { success: true, id: 'sprint-1' };
    mockSprintsService.remove.mockResolvedValue(response);

    const result = await controller.remove('sprint-1', { id: 'user-1' });
    expect(result).toEqual(response);
    expect(mockSprintsService.remove).toHaveBeenCalledWith('sprint-1', 'user-1');
  });
});
