import { ActivityService } from '../src/activity/activity.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testId: string, description: string) {
  if (condition) {
    console.log(`[PASS] ${testId}: ${description}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testId}: ${description}`);
    failed++;
  }
}

async function runUnitTests() {
  console.log('=== RUNNING ACTIVITY SERVICE UNIT TESTS ===\n');

  // Setup Mock Prisma
  const mockPrisma: any = {
    activityEvent: {
      findMany: null as any,
      count: null as any,
      create: null as any,
    },
    issue: {
      findUnique: null as any,
    },
    project: {
      findFirst: null as any,
    },
  };

  const service = new ActivityService(mockPrisma);

  // UNIT-01: Service is instantiated
  assert(service !== undefined, 'UNIT-01', 'ActivityService is instantiated successfully');

  // UNIT-02: getFeed returns structured response with default pagination
  {
    mockPrisma.activityEvent.count = async () => 1;
    mockPrisma.activityEvent.findMany = async (args: any) => {
      assert(args.take === 21, 'UNIT-02a', 'Default limit 20 queries limit+1 (take: 21)');
      assert(args.orderBy.timestamp === 'desc', 'UNIT-02b', 'Default order is timestamp DESC');
      return [
        {
          id: 'act-1',
          issueId: 'INB-1001',
          projectId: 'proj-1',
          userId: 'user-1',
          action: 'created',
          details: 'created ticket INB-1001',
          timestamp: new Date(),
          user: { id: 'user-1', name: 'User 1', email: 'u1@test.com', avatar: null, role: 'Developer' },
          issue: { id: 'INB-1001', title: 'Issue 1' },
          project: { id: 'proj-1', key: 'INB', name: 'Inbox' },
        },
      ];
    };

    const feed = await service.getFeed({});
    assert(feed.items.length === 1 && feed.total === 1 && feed.hasMore === false, 'UNIT-02', 'getFeed returns expected items, total, and hasMore');
  }

  // UNIT-03: getFeed throws NotFoundException for non-existent projectId
  {
    mockPrisma.project.findFirst = async () => null;
    let thrown = false;
    try {
      await service.getFeed({ projectId: 'missing-proj' });
    } catch (err) {
      if (err instanceof NotFoundException) thrown = true;
    }
    assert(thrown, 'UNIT-03', 'getFeed throws NotFoundException for non-existent projectId');
  }

  // UNIT-04: getFeed throws NotFoundException for non-existent issueId
  {
    mockPrisma.issue.findUnique = async () => null;
    let thrown = false;
    try {
      await service.getFeed({ issueId: 'INB-99999' });
    } catch (err) {
      if (err instanceof NotFoundException) thrown = true;
    }
    assert(thrown, 'UNIT-04', 'getFeed throws NotFoundException for non-existent issueId');
  }

  // UNIT-05: getFeed handles keyset cursor pagination with hasMore
  {
    mockPrisma.activityEvent.count = async () => 10;
    mockPrisma.activityEvent.findMany = async (args: any) => {
      assert(args.cursor?.id === 'cursor-123', 'UNIT-05a', 'Uses cursor ID in query');
      assert(args.skip === 1, 'UNIT-05b', 'Skips 1 row after cursor');
      assert(args.take === 3, 'UNIT-05c', 'Takes limit+1 (3 items for limit=2)');
      return [
        { id: 'act-2', timestamp: new Date() },
        { id: 'act-3', timestamp: new Date() },
        { id: 'act-4', timestamp: new Date() }, // extra item indicating hasMore
      ];
    };

    const feed = await service.getFeed({ limit: 2, cursor: 'cursor-123' });
    assert(feed.items.length === 2 && feed.hasMore === true && feed.nextCursor === 'act-3', 'UNIT-05', 'Correctly slices items and sets nextCursor and hasMore');
  }

  // UNIT-06: findByIssue returns events for valid issue
  {
    mockPrisma.issue.findUnique = async () => ({ id: 'INB-1001' });
    mockPrisma.activityEvent.findMany = async (args: any) => {
      assert(args.where.issueId === 'INB-1001', 'UNIT-06a', 'Filters by issueId');
      assert(args.orderBy.timestamp === 'desc', 'UNIT-06b', 'Orders by timestamp DESC');
      return [{ id: 'act-1', issueId: 'INB-1001', timestamp: new Date() }];
    };

    const events = await service.findByIssue('INB-1001');
    assert(events.length === 1 && events[0].id === 'act-1', 'UNIT-06', 'findByIssue returns events array');
  }

  // UNIT-07: findByIssue throws NotFoundException for missing issue
  {
    mockPrisma.issue.findUnique = async () => null;
    let thrown = false;
    try {
      await service.findByIssue('MISSING');
    } catch (err) {
      if (err instanceof NotFoundException) thrown = true;
    }
    assert(thrown, 'UNIT-07', 'findByIssue throws NotFoundException for unknown issue');
  }

  // UNIT-08: findByProject returns events for valid project
  {
    mockPrisma.project.findFirst = async () => ({ id: 'proj-1' });
    mockPrisma.activityEvent.findMany = async (args: any) => {
      assert(args.where.projectId === 'proj-1', 'UNIT-08a', 'Filters by projectId');
      assert(args.orderBy.timestamp === 'desc', 'UNIT-08b', 'Orders by timestamp DESC');
      return [{ id: 'act-1', projectId: 'proj-1', timestamp: new Date() }];
    };

    const events = await service.findByProject('proj-1');
    assert(events.length === 1 && events[0].id === 'act-1', 'UNIT-08', 'findByProject returns events array');
  }

  // UNIT-09: findByProject throws NotFoundException for missing project
  {
    mockPrisma.project.findFirst = async () => null;
    let thrown = false;
    try {
      await service.findByProject('MISSING');
    } catch (err) {
      if (err instanceof NotFoundException) thrown = true;
    }
    assert(thrown, 'UNIT-09', 'findByProject throws NotFoundException for unknown project');
  }

  // UNIT-10: logEvent creates event in Prisma
  {
    mockPrisma.activityEvent.create = async (args: any) => {
      assert(args.data.userId === 'user-1', 'UNIT-10a', 'Correct actor userId');
      assert(args.data.action === 'created', 'UNIT-10b', 'Correct action verb');
      assert(args.data.details === 'created ticket', 'UNIT-10c', 'Correct details payload');
      return { id: 'act-new', ...args.data, timestamp: new Date() };
    };

    const created = await service.logEvent({
      userId: 'user-1',
      action: 'created',
      details: 'created ticket',
      issueId: 'INB-1001',
    });
    assert(created.id === 'act-new', 'UNIT-10', 'logEvent persists and returns ActivityEvent');
  }

  // UNIT-11: logEvent throws BadRequestException if required fields are missing
  {
    let thrown = false;
    try {
      await service.logEvent({ userId: '', action: '', details: '' });
    } catch (err) {
      if (err instanceof BadRequestException) thrown = true;
    }
    assert(thrown, 'UNIT-11', 'logEvent rejects missing required parameters with BadRequestException');
  }

  console.log(`\n=== UNIT TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runUnitTests();
