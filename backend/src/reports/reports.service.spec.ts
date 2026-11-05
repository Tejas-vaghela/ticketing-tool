import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: any;

  const mockCreatedDate = new Date(Date.now() - 3600000 * 5); // 5 hours ago
  const mockResolvedDate = new Date(Date.now() - 3600000 * 2); // 2 hours ago

  const mockIssues = [
    {
      id: 'issue-1',
      status: 'Resolved',
      priority: 'High',
      supportLevel: 'L1',
      isEscalated: false,
      responseSLAHours: 4,
      resolutionSLAHours: 24,
      firstRespondedAt: new Date(Date.now() - 3600000 * 4),
      resolvedAt: mockResolvedDate,
      createdDate: mockCreatedDate,
      projectId: 'proj-1',
      project: { id: 'proj-1', name: 'Web App', key: 'WEB' },
    },
    {
      id: 'issue-2',
      status: 'Open',
      priority: 'Highest',
      supportLevel: 'L2',
      isEscalated: true,
      responseSLAHours: 1,
      resolutionSLAHours: 4,
      firstRespondedAt: null,
      resolvedAt: null,
      createdDate: new Date(Date.now() - 3600000 * 10), // 10h ago (> 4h SLA => breached)
      projectId: 'proj-1',
      project: { id: 'proj-1', name: 'Web App', key: 'WEB' },
    },
  ];

  beforeEach(async () => {
    prisma = {
      issue: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSummary', () => {
    it('should calculate issue counts and SLA compliance correctly', async () => {
      prisma.issue.findMany.mockResolvedValue(mockIssues);

      const result = await service.getSummary();

      expect(result.total).toBe(2);
      expect(result.breached).toBe(1); // issue-2 breached 4h resolution SLA
      expect(result.within).toBe(1); // issue-1 resolved within 3h (< 24h)
      expect(result.escalated).toBe(1);
      expect(result.complianceRate).toBe(50); // 1 out of 2 breached => 50%
      expect(result.statusCounts.Resolved).toBe(1);
      expect(result.statusCounts.Open).toBe(1);
      expect(result.priorityCounts.High).toBe(1);
      expect(result.priorityCounts.Highest).toBe(1);
      expect(result.tierCounts.L1).toBe(1);
      expect(result.tierCounts.L2).toBe(1);
      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].total).toBe(2);
      expect(result.projects[0].resolved).toBe(1);
    });

    it('should filter by projectId when provided', async () => {
      prisma.issue.findMany.mockResolvedValue([]);

      await service.getSummary('proj-1');

      expect(prisma.issue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'proj-1' },
        }),
      );
    });
  });

  describe('getSlaMetrics', () => {
    it('should compute average resolution and response hours', async () => {
      prisma.issue.findMany
        .mockResolvedValueOnce(mockIssues) // for getSummary()
        .mockResolvedValueOnce([
          {
            createdDate: new Date(Date.now() - 3600000 * 4),
            resolvedAt: new Date(Date.now() - 3600000 * 2), // 2h resolution
            firstRespondedAt: new Date(Date.now() - 3600000 * 3), // 1h response
          },
        ]); // for resolvedIssues query

      const result = await service.getSlaMetrics();

      expect(result.avgResolutionHours).toBe(2);
      expect(result.avgResponseHours).toBe(1);
      expect(result.resolvedCount).toBe(1);
    });
  });
});
