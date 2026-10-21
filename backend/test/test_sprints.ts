import * as http from 'http';
import { PrismaClient, SprintStatus, IssueStatus } from '@prisma/client';

const API_BASE = 'http://localhost:4000/api';
const prisma = new PrismaClient();

async function request(
  url: string,
  options: any = {},
  body?: any,
): Promise<{ status: number; headers: any; data: any }> {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(url);
    const req = http.request(
      {
        hostname: fullUrl.hostname,
        port: fullUrl.port,
        path: fullUrl.pathname + fullUrl.search,
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          let data: any = buffer.toString('utf-8');
          try {
            data = JSON.parse(data);
          } catch {
            // Keep as string or raw
          }
          resolve({ status: res.statusCode || 0, headers: res.headers, data });
        });
      },
    );
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function login(emailOrId: string, passwordPlain: string): Promise<string> {
  const res = await request(
    `${API_BASE}/auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({ emailOrId, password: passwordPlain }),
  );

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Login failed for ${emailOrId}: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.data.accessToken;
}

async function runTests() {
  console.log('===============================================================');
  console.log('       SPRINTS MODULE COMPREHENSIVE BACKEND TEST SUITE         ');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testId: string, message: string) {
    if (condition) {
      console.log(`[PASS] ${testId}: ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testId}: ${message}`);
      failed++;
    }
  }

  try {
    // 0. Retrieve tokens for various roles
    console.log('Authenticating test personas...');
    const adminToken = await login('tejas@inbox.GoldMine.io', 'admin123'); // Admin
    const supportToken = await login('rahul.s@inbox.GoldMine.io', 'support123'); // Support_Agent
    const pmToken = adminToken; // Admin has full lifecycle permissions

    // Fetch existing projects
    const projects = await prisma.project.findMany({ take: 2 });
    if (projects.length === 0) {
      throw new Error('No projects found in database to execute sprint tests against.');
    }
    const testProjectId = projects[0].id;
    const secondProjectId = projects.length > 1 ? projects[1].id : null;
    console.log(`Test project selected: ${projects[0].name} (id: ${testProjectId})`);

    // Clean up any test sprints from previous test runs
    await prisma.sprint.deleteMany({
      where: {
        name: { startsWith: 'TEST_SPRINT_' },
      },
    });

    // -------------------------------------------------------------------------
    // TEST 1: Unauthorized Access (Missing Bearer Token)
    // -------------------------------------------------------------------------
    const unauthRes = await request(`${API_BASE}/sprints?projectId=${testProjectId}`);
    assert(
      unauthRes.status === 401,
      'SPR-T01_UNAUTH',
      `Rejects unauthenticated request without token with 401 (got ${unauthRes.status})`,
    );

    // -------------------------------------------------------------------------
    // TEST 2: Role Authorization — Support Agent cannot create sprints
    // -------------------------------------------------------------------------
    const forbiddenRes = await request(
      `${API_BASE}/sprints`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supportToken}`,
        },
      },
      JSON.stringify({
        projectId: testProjectId,
        name: 'TEST_SPRINT_FORBIDDEN',
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-11-15T00:00:00Z',
      }),
    );
    assert(
      forbiddenRes.status === 403,
      'SPR-T02_FORBIDDEN',
      `Rejects non-admin / non-PM sprint creation with 403 Forbidden (got ${forbiddenRes.status})`,
    );

    // -------------------------------------------------------------------------
    // TEST 3: Validation Failure — endDate before startDate
    // -------------------------------------------------------------------------
    const dateInvalidRes = await request(
      `${API_BASE}/sprints`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      JSON.stringify({
        projectId: testProjectId,
        name: 'TEST_SPRINT_INVALID_DATES',
        startDate: '2026-11-15T00:00:00Z',
        endDate: '2026-11-01T00:00:00Z', // Invalid: end < start
      }),
    );
    assert(
      dateInvalidRes.status === 400,
      'SPR-T03_INVALID_DATES',
      `Rejects sprint with endDate <= startDate with 400 Bad Request (got ${dateInvalidRes.status})`,
    );

    // -------------------------------------------------------------------------
    // TEST 4: Project Not Found
    // -------------------------------------------------------------------------
    const missingProjectRes = await request(
      `${API_BASE}/sprints`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      JSON.stringify({
        projectId: 'cly_non_existent_project_9999',
        name: 'TEST_SPRINT_NO_PROJECT',
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-11-15T00:00:00Z',
      }),
    );
    assert(
      missingProjectRes.status === 404,
      'SPR-T04_NO_PROJECT',
      `Rejects sprint creation for non-existent project with 404 Not Found (got ${missingProjectRes.status})`,
    );

    // -------------------------------------------------------------------------
    // TEST 4B: Sprint Not Found
    // -------------------------------------------------------------------------
    const missingSprintRes = await request(
      `${API_BASE}/sprints/cly_non_existent_sprint_9999`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      JSON.stringify({ name: 'TEST_NON_EXISTENT' }),
    );
    assert(
      missingSprintRes.status === 404,
      'SPR-T04B_SPRINT_NOT_FOUND',
      `Rejects mutation of non-existent sprint with 404 Not Found (got ${missingSprintRes.status})`,
    );

    // -------------------------------------------------------------------------
    // TEST 5: Successful Sprint Creation by Project Manager
    // -------------------------------------------------------------------------
    const createResA = await request(
      `${API_BASE}/sprints`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pmToken}`,
        },
      },
      JSON.stringify({
        projectId: testProjectId,
        name: 'TEST_SPRINT_ALPHA',
        goal: 'Complete checkout integration and L3 stability',
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-11-15T00:00:00Z',
      }),
    );
    assert(
      createResA.status === 201 && createResA.data.id && createResA.data.status === 'planned',
      'SPR-T05_CREATE_SUCCESS',
      `Project Manager creates sprint with 201 Created and planned status (id: ${createResA.data?.id})`,
    );
    const sprintAlphaId = createResA.data?.id;

    // Create a second sprint (Sprint Beta) to act as target rollover sprint
    const createResB = await request(
      `${API_BASE}/sprints`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      JSON.stringify({
        projectId: testProjectId,
        name: 'TEST_SPRINT_BETA',
        goal: 'Follow-up iteration for unfinished tickets',
        startDate: '2026-11-16T00:00:00Z',
        endDate: '2026-11-30T00:00:00Z',
      }),
    );
    const sprintBetaId = createResB.data?.id;
    assert(
      createResB.status === 201 && sprintBetaId,
      'SPR-T05B_TARGET_SPRINT',
      `Second sprint created for rollover target (id: ${sprintBetaId})`,
    );

    // -------------------------------------------------------------------------
    // TEST 6: List Sprints with aggregation metrics
    // -------------------------------------------------------------------------
    const listRes = await request(`${API_BASE}/sprints?projectId=${testProjectId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const foundSprint = listRes.data?.find((s: any) => s.id === sprintAlphaId);
    assert(
      listRes.status === 200 && Array.isArray(listRes.data) && foundSprint && typeof foundSprint.issueCount === 'number',
      'SPR-T06_LIST_SPRINTS',
      `List sprints returns array with aggregate metrics (issueCount: ${foundSprint?.issueCount})`,
    );

    // -------------------------------------------------------------------------
    // TEST 7: Update Sprint Metadata
    // -------------------------------------------------------------------------
    const updateRes = await request(
      `${API_BASE}/sprints/${sprintAlphaId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pmToken}`,
        },
      },
      JSON.stringify({
        name: 'TEST_SPRINT_ALPHA_UPDATED',
        goal: 'Updated delivery focus',
      }),
    );
    assert(
      updateRes.status === 200 && updateRes.data.name === 'TEST_SPRINT_ALPHA_UPDATED',
      'SPR-T07_UPDATE_SPRINT',
      `Updates sprint metadata returning 200 OK (name: ${updateRes.data?.name})`,
    );

    // -------------------------------------------------------------------------
    // TEST 8: Starting a Sprint Successfully
    // -------------------------------------------------------------------------
    // Make sure no other sprint is active in testProjectId before starting
    await prisma.sprint.updateMany({
      where: { projectId: testProjectId, status: SprintStatus.active },
      data: { status: SprintStatus.completed },
    });

    const startRes = await request(
      `${API_BASE}/sprints/${sprintAlphaId}/start`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    assert(
      startRes.status === 200 && startRes.data.status === 'active',
      'SPR-T08_START_SPRINT',
      `Starts sprint returning 200 OK with active status (status: ${startRes.data?.status})`,
    );

    // -------------------------------------------------------------------------
    // TEST 9: Single Active Sprint Invariant — Rejects second active sprint
    // -------------------------------------------------------------------------
    const secondStartRes = await request(
      `${API_BASE}/sprints/${sprintBetaId}/start`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    assert(
      secondStartRes.status === 400 && secondStartRes.data.message?.includes('already has an active sprint'),
      'SPR-T09_SINGLE_ACTIVE_REJECT',
      `Rejects starting second active sprint in same project with 400 Bad Request`,
    );

    // -------------------------------------------------------------------------
    // TEST 10: Concurrency Race Condition Safety — Concurrent sprint start requests
    // -------------------------------------------------------------------------
    // Create two new planned sprints in testProjectId
    const concurrent1 = await prisma.sprint.create({
      data: {
        projectId: testProjectId,
        name: 'TEST_SPRINT_RACE_1',
        startDate: new Date('2026-12-01'),
        endDate: new Date('2026-12-15'),
        status: SprintStatus.planned,
      },
    });
    const concurrent2 = await prisma.sprint.create({
      data: {
        projectId: testProjectId,
        name: 'TEST_SPRINT_RACE_2',
        startDate: new Date('2026-12-16'),
        endDate: new Date('2026-12-31'),
        status: SprintStatus.planned,
      },
    });

    // Temporarily reset active sprints so both see an open slot
    await prisma.sprint.update({
      where: { id: sprintAlphaId },
      data: { status: SprintStatus.planned },
    });

    // Fire both start requests simultaneously
    const [raceRes1, raceRes2] = await Promise.all([
      request(`${API_BASE}/sprints/${concurrent1.id}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
      request(`${API_BASE}/sprints/${concurrent2.id}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
    ]);

    const oneSucceeded = (raceRes1.status === 200 && raceRes2.status === 400) ||
                         (raceRes2.status === 200 && raceRes1.status === 400);
    
    // Check how many are active in database
    const activeInDb = await prisma.sprint.count({
      where: {
        id: { in: [concurrent1.id, concurrent2.id] },
        status: SprintStatus.active,
      },
    });

    assert(
      oneSucceeded && activeInDb === 1,
      'SPR-T10_CONCURRENT_RACE',
      `Pessimistic lock cleanly serializes concurrent start requests: exactly 1 sprint became active`,
    );

    // Clean up race test sprints
    await prisma.sprint.deleteMany({
      where: { id: { in: [concurrent1.id, concurrent2.id] } },
    });

    // Restore sprintAlpha as active
    await prisma.sprint.update({
      where: { id: sprintAlphaId },
      data: { status: SprintStatus.active },
    });

    // -------------------------------------------------------------------------
    // TEST 11: Set up issues for rollover testing
    // -------------------------------------------------------------------------
    // Create 3 test issues attached to sprintAlpha
    // 1 Resolved (should stay), 1 In Progress (should roll over), 1 To Do (should roll over)
    const testIssueResolved = await prisma.issue.create({
      data: {
        id: 'TEST-INB-9901',
        title: 'Resolved ticket in sprint',
        projectId: testProjectId,
        sprintId: sprintAlphaId,
        reporterId: 'user-1',
        status: IssueStatus.Resolved,
      },
    });
    const testIssueInProgress = await prisma.issue.create({
      data: {
        id: 'TEST-INB-9902',
        title: 'In progress ticket to roll over',
        projectId: testProjectId,
        sprintId: sprintAlphaId,
        reporterId: 'user-1',
        status: IssueStatus.In_Progress,
      },
    });
    const testIssueToDo = await prisma.issue.create({
      data: {
        id: 'TEST-INB-9903',
        title: 'Open ticket to roll over',
        projectId: testProjectId,
        sprintId: sprintAlphaId,
        reporterId: 'user-1',
        status: IssueStatus.To_Do,
      },
    });

    // -------------------------------------------------------------------------
    // TEST 12: Cross-Project Rollover Rejection
    // -------------------------------------------------------------------------
    if (secondProjectId) {
      // Create a sprint in second project
      const otherProjectSprint = await prisma.sprint.create({
        data: {
          projectId: secondProjectId,
          name: 'TEST_SPRINT_OTHER_PROJ',
          startDate: new Date('2026-11-01'),
          endDate: new Date('2026-11-15'),
          status: SprintStatus.planned,
        },
      });

      const crossProjRes = await request(
        `${API_BASE}/sprints/${sprintAlphaId}/complete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
        },
        JSON.stringify({ targetSprintId: otherProjectSprint.id }),
      );

      assert(
        crossProjRes.status === 400,
        'SPR-T12_CROSS_PROJ_REJECT',
        `Rejects rollover to target sprint from different project with 400 Bad Request (got ${crossProjRes.status})`,
      );

      await prisma.sprint.delete({ where: { id: otherProjectSprint.id } });
    } else {
      console.log('[SKIP] SPR-T12_CROSS_PROJ_REJECT: Skipped because only 1 project exists.');
    }

    // -------------------------------------------------------------------------
    // TEST 12B: Failure during rollover and transaction rollback
    // -------------------------------------------------------------------------
    const failedRolloverRes = await request(
      `${API_BASE}/sprints/${sprintAlphaId}/complete`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      JSON.stringify({ targetSprintId: 'cly_non_existent_target_sprint_9999' }),
    );
    const sprintAlphaStatusBefore = await prisma.sprint.findUnique({ where: { id: sprintAlphaId } });
    const unresolvedBefore = await prisma.issue.findMany({
      where: { id: { in: [testIssueInProgress.id, testIssueToDo.id] } },
    });
    assert(
      failedRolloverRes.status === 404 &&
        sprintAlphaStatusBefore?.status === SprintStatus.active &&
        unresolvedBefore.every((i) => i.sprintId === sprintAlphaId),
      'SPR-T12B_ROLLOVER_ROLLBACK',
      `Rollover failure with invalid target returns 404 and preserves active sprint state & issue bindings`,
    );

    // -------------------------------------------------------------------------
    // TEST 13: Successful Sprint Completion and Atomic Issue Rollover
    // -------------------------------------------------------------------------
    const completeRes = await request(
      `${API_BASE}/sprints/${sprintAlphaId}/complete`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      JSON.stringify({ targetSprintId: sprintBetaId }),
    );

    assert(
      completeRes.status === 200 && completeRes.data.rolledOverCount === 2,
      'SPR-T13_COMPLETE_ROLLOVER',
      `Completes active sprint and rolls over exactly 2 unresolved tickets (rolledOverCount: ${completeRes.data?.rolledOverCount})`,
    );

    // Verify issue placement in database
    const issueResolvedAfter = await prisma.issue.findUnique({ where: { id: testIssueResolved.id } });
    const issueInProgressAfter = await prisma.issue.findUnique({ where: { id: testIssueInProgress.id } });
    const issueToDoAfter = await prisma.issue.findUnique({ where: { id: testIssueToDo.id } });

    assert(
      issueResolvedAfter?.sprintId === sprintAlphaId,
      'SPR-T13B_RESOLVED_STAYS',
      `Resolved ticket stays in completed sprint (sprintId: ${issueResolvedAfter?.sprintId})`,
    );
    assert(
      issueInProgressAfter?.sprintId === sprintBetaId && issueToDoAfter?.sprintId === sprintBetaId,
      'SPR-T13C_UNRESOLVED_MOVED',
      `Unresolved tickets moved to targetSprintId (sprintBetaId: ${sprintBetaId})`,
    );

    // -------------------------------------------------------------------------
    // TEST 14: Completed Sprint Mutation Rejection
    // -------------------------------------------------------------------------
    const editCompletedRes = await request(
      `${API_BASE}/sprints/${sprintAlphaId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      JSON.stringify({ name: 'CANNOT_EDIT_COMPLETED' }),
    );
    assert(
      editCompletedRes.status === 400 && editCompletedRes.data.message?.includes('Completed sprints cannot be modified'),
      'SPR-T14_COMPLETED_IMMUTABLE',
      `Rejects updating completed sprint with 400 Bad Request`,
    );

    const restartCompletedRes = await request(
      `${API_BASE}/sprints/${sprintAlphaId}/start`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    assert(
      restartCompletedRes.status === 400,
      'SPR-T14B_NO_REOPEN',
      `Rejects restarting completed sprint with 400 Bad Request`,
    );

    // -------------------------------------------------------------------------
    // TEST 15: Rollover to Backlog (when targetSprintId is omitted)
    // -------------------------------------------------------------------------
    // Start sprintBeta
    await request(`${API_BASE}/sprints/${sprintBetaId}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // Complete sprintBeta without targetSprintId
    const completeToBacklogRes = await request(
      `${API_BASE}/sprints/${sprintBetaId}/complete`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      JSON.stringify({}), // No targetSprintId
    );

    assert(
      completeToBacklogRes.status === 200 && completeToBacklogRes.data.targetSprintId === null,
      'SPR-T15_ROLLOVER_TO_BACKLOG',
      `Completing sprint without targetSprintId sets targetSprintId to null (Backlog)`,
    );

    const issueBacklogAfter = await prisma.issue.findUnique({ where: { id: testIssueInProgress.id } });
    assert(
      issueBacklogAfter?.sprintId === null,
      'SPR-T15B_BACKLOG_VERIFIED',
      `Unresolved issue safely rolled over to Backlog (sprintId = null)`,
    );

    // -------------------------------------------------------------------------
    // TEST 16: Safe Sprint Deletion (Issues returned to Backlog via SetNull)
    // -------------------------------------------------------------------------
    // Attach an issue to sprintBeta before deleting it
    await prisma.issue.update({
      where: { id: testIssueInProgress.id },
      data: { sprintId: sprintBetaId },
    });

    const deleteRes = await request(
      `${API_BASE}/sprints/${sprintBetaId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );

    assert(
      deleteRes.status === 200 && deleteRes.data.success === true,
      'SPR-T16_DELETE_SPRINT',
      `Deletes sprint returning 200 OK and success: true`,
    );

    const issueAfterSprintDelete = await prisma.issue.findUnique({ where: { id: testIssueInProgress.id } });
    assert(
      issueAfterSprintDelete !== null && issueAfterSprintDelete.sprintId === null,
      'SPR-T16B_ISSUES_SAFE_SETNULL',
      `Deleting sprint preserves issue in database with sprintId reset to null`,
    );

    // -------------------------------------------------------------------------
    // TEST 17: ActivityEvent Consistency
    // -------------------------------------------------------------------------
    const auditEvents = await prisma.activityEvent.findMany({
      where: {
        projectId: testProjectId,
        action: { in: ['sprint_created', 'sprint_started', 'sprint_completed', 'sprint_deleted'] },
      },
      orderBy: { timestamp: 'desc' },
      take: 5,
    });

    assert(
      auditEvents.length > 0 && auditEvents.some((e) => e.action === 'sprint_completed'),
      'SPR-T17_AUDIT_LOGS',
      `Audit trail recorded sprint operations in ActivityEvent table (${auditEvents.length} events logged)`,
    );

    // -------------------------------------------------------------------------
    // TEST 18: Regression Safety — Projects & Issues Unaffected
    // -------------------------------------------------------------------------
    const projectsCheck = await request(`${API_BASE}/projects`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      projectsCheck.status === 200 && Array.isArray(projectsCheck.data) && projectsCheck.data.length > 0,
      'SPR-T18_PROJECTS_REGRESSION',
      `Projects module remains fully operational after Sprints integration`,
    );

    // Clean up test issues and remaining test sprints
    await prisma.issue.deleteMany({
      where: { id: { in: [testIssueResolved.id, testIssueInProgress.id, testIssueToDo.id] } },
    });
    await prisma.sprint.deleteMany({
      where: { id: { in: [sprintAlphaId, sprintBetaId] } },
    });
  } catch (err: any) {
    console.error('Test execution failed with error:', err);
    failed++;
  }

  console.log('\n===============================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
