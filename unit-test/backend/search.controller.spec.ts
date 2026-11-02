const vi = jest;
import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from '../../backend/src/search/search.controller';
import { SearchService } from '../../backend/src/search/search.service';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../backend/src/common/guards/roles.guard';

describe('SearchController', () => {
  let controller: SearchController;
  let service: SearchService;

  const mockSearchService = {
    search: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        { provide: SearchService, useValue: mockSearchService },
        Reflector,
        RolesGuard,
      ],
    }).compile();

    controller = module.get<SearchController>(SearchController);
    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  it('should call searchService.search with DTO and user ID', async () => {
    const dto = { q: 'login', page: 1, limit: 10 };
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    const expectedResponse = {
      success: true,
      message: 'Search completed successfully',
      data: {
        query: 'login',
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
        results: [],
        categorized: { issues: [], projects: [], epics: [], sprints: [], users: [] },
        issues: [],
        projects: [],
        epics: [],
        sprints: [],
        users: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      },
      query: 'login',
      totalCount: 0,
      issues: [],
      projects: [],
      epics: [],
      sprints: [],
      users: [],
    };

    mockSearchService.search.mockResolvedValue(expectedResponse);

    const result = await controller.search(dto as any, mockUser);

    expect(mockSearchService.search).toHaveBeenCalledWith(dto, 'user-1');
    expect(result).toEqual(expectedResponse);
  });
});
