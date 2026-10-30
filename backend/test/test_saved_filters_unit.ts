import { SavedFiltersService } from '../src/saved-filters/saved-filters.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

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
  console.log('=== RUNNING SAVED FILTERS SERVICE UNIT TESTS ===\n');

  const mockDb: any[] = [
    {
      id: 'filter-1',
      userId: 'user-1',
      name: 'High Priority Open',
      filters: { priority: 'High', status: 'Open' },
    },
    {
      id: 'filter-2',
      userId: 'user-2',
      name: 'User 2 Escalations',
      filters: { supportLevel: 'L3' },
    },
  ];

  const mockPrisma: any = {
    savedFilter: {
      findMany: async (args: any) => {
        let results = mockDb.filter((f) => f.userId === args.where.userId);
        if (args.where.name?.contains) {
          const search = args.where.name.contains.toLowerCase();
          results = results.filter((f) => f.name.toLowerCase().includes(search));
        }
        return results;
      },
      findUnique: async (args: any) => {
        return mockDb.find((f) => f.id === args.where.id) || null;
      },
      create: async (args: any) => {
        const item = { id: `filter-${mockDb.length + 1}`, ...args.data };
        mockDb.push(item);
        return item;
      },
      update: async (args: any) => {
        const item = mockDb.find((f) => f.id === args.where.id);
        if (item) {
          Object.assign(item, args.data);
        }
        return item;
      },
      delete: async (args: any) => {
        const idx = mockDb.findIndex((f) => f.id === args.where.id);
        if (idx !== -1) mockDb.splice(idx, 1);
        return { id: args.where.id };
      },
    },
  };

  const service = new SavedFiltersService(mockPrisma);

  // UNIT-01: Service is instantiated
  assert(service !== undefined, 'UNIT-01', 'SavedFiltersService is instantiated successfully');

  // UNIT-02: User isolation in findAll
  const user1Filters = await service.findAll('user-1');
  assert(user1Filters.length === 1 && user1Filters[0].id === 'filter-1', 'UNIT-02', 'findAll returns only user-1 filters');

  // UNIT-03: findOne succeeds for owner
  const ownFilter = await service.findOne('filter-1', 'user-1');
  assert(ownFilter.name === 'High Priority Open', 'UNIT-03', 'findOne succeeds for filter owner');

  // UNIT-04: findOne throws ForbiddenException for non-owner
  let forbiddenCaught = false;
  try {
    await service.findOne('filter-2', 'user-1');
  } catch (err) {
    if (err instanceof ForbiddenException) forbiddenCaught = true;
  }
  assert(forbiddenCaught, 'UNIT-04', 'findOne enforces isolation and throws ForbiddenException for non-owner');

  // UNIT-05: findOne throws NotFoundException for non-existent filter
  let notFoundCaught = false;
  try {
    await service.findOne('non-existent', 'user-1');
  } catch (err) {
    if (err instanceof NotFoundException) notFoundCaught = true;
  }
  assert(notFoundCaught, 'UNIT-05', 'findOne throws NotFoundException when filter ID does not exist');

  // UNIT-06: create persists new filter with user association
  const created = await service.create('user-1', {
    name: 'My New Filter',
    filters: { status: 'Closed' },
  });
  assert(created.userId === 'user-1' && created.name === 'My New Filter', 'UNIT-06', 'create persists filter with correct userId');

  // UNIT-07: delete removes filter for owner
  const deleteRes = await service.remove('filter-1', 'user-1');
  assert(deleteRes.success === true, 'UNIT-07', 'remove returns { success: true } for owner');

  // UNIT-08: delete throws ForbiddenException when attempting to delete another user filter
  let deleteForbiddenCaught = false;
  try {
    await service.remove('filter-2', 'user-1');
  } catch (err) {
    if (err instanceof ForbiddenException) deleteForbiddenCaught = true;
  }
  assert(deleteForbiddenCaught, 'UNIT-08', 'remove prevents deleting another user filter');

  console.log(`\n=== UNIT TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runUnitTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

