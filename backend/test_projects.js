const { PrismaClient } = require('@prisma/client');

const API_BASE = 'http://localhost:4000/api';
const prisma = new PrismaClient();

async function runProjectsTestSuite() {
  console.log('================================================================');
  console.log('PROJECTS MODULE AUTOMATED VERIFICATION SUITE (PRJ-T01 - PRJ-T15)');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;
  const createdProjectIds = [];
  const createdUserIds = [];

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // Setup: Authenticate Admin & Support Agent, and provision PM & Engineer
    // -------------------------------------------------------------------------
    console.log('>>> Setup: Authenticating Admin and provisioning verified test accounts...');

    // 1. Admin login
    const adminLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrId: 'tejas@inbox.GoldMine.io', password: 'admin123' }),
    });
    assert(adminLoginRes.status === 200, `Admin authenticated (${adminLoginRes.status})`);
    const adminData = await adminLoginRes.json();
    const adminToken = adminData.accessToken;
    const adminId = adminData.user.id;

    // 2. Support Agent login
    const agentLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrId: 'rahul.s@inbox.GoldMine.io', password: 'support123' }),
    });
    assert(agentLoginRes.status === 200, `Support Agent authenticated (${agentLoginRes.status})`);
    const agentData = await agentLoginRes.json();
    const agentToken = agentData.accessToken;

    // 3. Provision verified Project Manager test user
    const pmEmail = `pm.test.${Date.now()}@inbox.goldmine.io`;
    const createPmRes = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Automated Project Manager',
        email: pmEmail,
        password: 'PmPassword123!',
        role: 'Project_Manager',
        department: 'Delivery Management',
        supportLevels: ['L1'],
      }),
    });
    assert(createPmRes.status === 201, `Project Manager test user provisioned (got ${createPmRes.status})`);
    const pmUser = await createPmRes.json();
    const pmId = pmUser.id;
    createdUserIds.push(pmId);

    const pmLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrId: pmEmail, password: 'PmPassword123!' }),
    });
    assert(pmLoginRes.status === 200, `Project Manager authenticated (${pmLoginRes.status})`);
    const pmData = await pmLoginRes.json();
    const pmToken = pmData.accessToken;

    // 4. Provision verified Engineer test user
    const engEmail = `eng.test.${Date.now()}@inbox.goldmine.io`;
    const createEngRes = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Automated Engineer User',
        email: engEmail,
        password: 'EngPassword123!',
        role: 'Engineer',
        department: 'Core Platform Engineering',
        supportLevels: ['L3'],
      }),
    });
    assert(createEngRes.status === 201, `Engineer test user provisioned (got ${createEngRes.status})`);
    const engUser = await createEngRes.json();
    const engId = engUser.id;
    createdUserIds.push(engId);

    const engLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrId: engEmail, password: 'EngPassword123!' }),
    });
    assert(engLoginRes.status === 200, `Engineer authenticated (${engLoginRes.status})`);
    const engData = await engLoginRes.json();
    const engToken = engData.accessToken;

    // =========================================================================
    // PRJ-T01: Project List Retrieval (GET /api/projects)
    // =========================================================================
    console.log('\n--- PRJ-T01: Project List Retrieval (GET /api/projects) ---');
    const listRes = await fetch(`${API_BASE}/projects`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(listRes.status === 200, `Admin retrieves projects list (got ${listRes.status})`);
    const listData = await listRes.json();
    assert(Array.isArray(listData), 'Projects response is an array');

    // All roles can list projects
    const pmListRes = await fetch(`${API_BASE}/projects`, {
      headers: { Authorization: `Bearer ${pmToken}` },
    });
    assert(pmListRes.status === 200, `Project Manager can list projects (got ${pmListRes.status})`);

    const engListRes = await fetch(`${API_BASE}/projects`, {
      headers: { Authorization: `Bearer ${engToken}` },
    });
    assert(engListRes.status === 200, `Engineer can list projects (got ${engListRes.status})`);

    const agentListRes = await fetch(`${API_BASE}/projects`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    assert(agentListRes.status === 200, `Support Agent can list projects (got ${agentListRes.status})`);

    // =========================================================================
    // PRJ-T04: Project Creation by Admin (POST /api/projects)
    // =========================================================================
    console.log('\n--- PRJ-T04: Project Creation by Admin (POST /api/projects) ---');
    const testKeyA = 'INBA' + Math.floor(Math.random() * 899 + 100);
    const createRes = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        key: testKeyA,
        name: 'Automated Test Repository Alpha',
        description: 'Test project created during automated verification suite.',
        category: 'Software',
        leadId: adminId,
        memberIds: [adminId, pmId],
        status: 'Active',
      }),
    });
    assert(createRes.status === 201, `Admin creates project successfully (got ${createRes.status})`);
    const createdProjectA = await createRes.json();
    assert(createdProjectA.id && createdProjectA.id.length > 5, `Project assigned persistent ID: ${createdProjectA.id}`);
    assert(createdProjectA.key === testKeyA, `Project key correctly assigned: ${createdProjectA.key}`);
    assert(createdProjectA.leadId === adminId, `Project leadId matches Admin`);
    assert(Array.isArray(createdProjectA.memberIds), 'Project memberIds is an array');
    assert(createdProjectA.memberIds.includes(adminId), 'Admin is in memberIds');
    createdProjectIds.push(createdProjectA.id);

    // Verify in PostgreSQL database
    const dbProjectA = await prisma.project.findUnique({
      where: { id: createdProjectA.id },
      include: { members: true },
    });
    assert(dbProjectA !== null, 'Project record persisted in PostgreSQL');
    assert(dbProjectA.key === testKeyA, 'Database key matches');

    // =========================================================================
    // PRJ-T02: Project Detail Retrieval by CUID (GET /api/projects/:id)
    // =========================================================================
    console.log('\n--- PRJ-T02: Project Detail Retrieval by CUID (GET /api/projects/:id) ---');
    const getByIdRes = await fetch(`${API_BASE}/projects/${createdProjectA.id}`, {
      headers: { Authorization: `Bearer ${engToken}` },
    });
    assert(getByIdRes.status === 200, `Engineer can retrieve project cockpit by CUID (got ${getByIdRes.status})`);
    const getByIdData = await getByIdRes.json();
    assert(getByIdData.id === createdProjectA.id, 'Cockpit ID matches CUID');
    assert(getByIdData.lead && getByIdData.lead.id === adminId, 'Cockpit includes lead profile');
    assert(Array.isArray(getByIdData.members), 'Cockpit includes members array');
    assert(getByIdData.metrics && typeof getByIdData.metrics.totalIssues === 'number', 'Cockpit includes telemetry metrics');

    // =========================================================================
    // PRJ-T03: Project Detail Retrieval by Key (GET /api/projects/:key)
    // =========================================================================
    console.log('\n--- PRJ-T03: Project Detail Retrieval by Key (GET /api/projects/:key) ---');
    const getByKeyRes = await fetch(`${API_BASE}/projects/${testKeyA}`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    assert(getByKeyRes.status === 200, `Support Agent can retrieve project cockpit by Key (got ${getByKeyRes.status})`);
    const getByKeyData = await getByKeyRes.json();
    assert(getByKeyData.id === createdProjectA.id, 'Cockpit retrieved by key matches project ID');

    // Nonexistent project lookup
    const nonExistentRes = await fetch(`${API_BASE}/projects/NONEXISTENTKEY999`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(nonExistentRes.status === 404, `Nonexistent project returns 404 Not Found (got ${nonExistentRes.status})`);

    // =========================================================================
    // PRJ-T05: Project Creation by Project Manager (POST /api/projects)
    // =========================================================================
    console.log('\n--- PRJ-T05: Project Creation by Project Manager (POST /api/projects) ---');
    const testKeyPM = 'PM' + Math.floor(Math.random() * 899 + 100);
    const pmCreateRes = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pmToken}`,
      },
      body: JSON.stringify({
        key: testKeyPM,
        name: 'PM Managed Project Workspace',
        description: 'Workspace managed by Project Manager.',
        category: 'Operations',
        leadId: pmId,
        memberIds: [pmId],
        status: 'Planning',
      }),
    });
    assert(pmCreateRes.status === 201, `Project Manager can create project (got ${pmCreateRes.status})`);
    const createdProjectPM = await pmCreateRes.json();
    createdProjectIds.push(createdProjectPM.id);

    // =========================================================================
    // PRJ-T06: Project Creation Blocked for Engineer & Support Agent (403)
    // =========================================================================
    console.log('\n--- PRJ-T06: Project Creation Blocked for Engineer & Support Agent (403) ---');
    const engCreateRes = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${engToken}`,
      },
      body: JSON.stringify({
        key: 'ENGBLOCKED',
        name: 'Engineer Attempted Project',
        leadId: adminId,
      }),
    });
    assert(engCreateRes.status === 403, `Engineer project creation blocked with 403 Forbidden (got ${engCreateRes.status})`);

    const agentCreateRes = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify({
        key: 'AGTBLOCKED',
        name: 'Agent Attempted Project',
        leadId: adminId,
      }),
    });
    assert(agentCreateRes.status === 403, `Support Agent project creation blocked with 403 Forbidden (got ${agentCreateRes.status})`);

    // =========================================================================
    // PRJ-T07: Duplicate Key Conflict Rejection (409)
    // =========================================================================
    console.log('\n--- PRJ-T07: Duplicate Key Conflict Rejection (409) ---');
    const dupRes = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        key: testKeyA,
        name: 'Duplicate Key Attempt',
        leadId: adminId,
      }),
    });
    assert(dupRes.status === 409, `Duplicate key rejected with 409 Conflict (got ${dupRes.status})`);
    const dupBody = await dupRes.json();
    assert(dupBody.message.includes('Unique constraint violation on key'), 'Conflict response mentions key uniqueness constraint');

    // =========================================================================
    // PRJ-T08: Nonexistent Lead Validation (400)
    // =========================================================================
    console.log('\n--- PRJ-T08: Nonexistent Lead Validation (400) ---');
    const badLeadRes = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        key: 'BADLEAD99',
        name: 'Bad Lead Project',
        leadId: 'nonexistent-user-id-999',
      }),
    });
    assert(badLeadRes.status === 400, `Nonexistent leadId rejected with 400 Bad Request (got ${badLeadRes.status})`);
    const badLeadBody = await badLeadRes.json();
    assert(badLeadBody.message.includes('does not exist'), 'Error specifies lead does not exist');

    // =========================================================================
    // PRJ-T09: Key Regex and Length Validation (400)
    // =========================================================================
    console.log('\n--- PRJ-T09: Key Regex and Length Validation (400) ---');
    // Lowercase key
    const lowerKeyRes = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        key: 'lowercase',
        name: 'Invalid Lowercase Key',
        leadId: adminId,
      }),
    });
    assert(lowerKeyRes.status === 400, `Lowercase key rejected with 400 Bad Request (got ${lowerKeyRes.status})`);

    // Too short (1 char)
    const shortKeyRes = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        key: 'A',
        name: 'Too Short Key',
        leadId: adminId,
      }),
    });
    assert(shortKeyRes.status === 400, `Too short key (< 2 chars) rejected with 400 Bad Request (got ${shortKeyRes.status})`);

    // Too long (> 10 chars)
    const longKeyRes = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        key: 'TOOLONGKEYPROJECT123',
        name: 'Too Long Key',
        leadId: adminId,
      }),
    });
    assert(longKeyRes.status === 400, `Too long key (> 10 chars) rejected with 400 Bad Request (got ${longKeyRes.status})`);

    // =========================================================================
    // PRJ-T10: Project Update by Project Manager (PATCH /api/projects/:id)
    // =========================================================================
    console.log('\n--- PRJ-T10: Project Update by Project Manager (PATCH /api/projects/:id) ---');
    const updateRes = await fetch(`${API_BASE}/projects/${createdProjectPM.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pmToken}`,
      },
      body: JSON.stringify({
        name: 'Updated PM Project Workspace Name',
        description: 'Successfully updated by Project Manager.',
        status: 'Active',
      }),
    });
    assert(updateRes.status === 200, `PM updates project returns 200 OK (got ${updateRes.status})`);
    const updatedData = await updateRes.json();
    assert(updatedData.name === 'Updated PM Project Workspace Name', 'Project name updated');
    assert(updatedData.description === 'Successfully updated by Project Manager.', 'Project description updated');
    assert(updatedData.status === 'Active', 'Project status updated');

    // =========================================================================
    // PRJ-T11: Project Update Blocked for Engineer (403)
    // =========================================================================
    console.log('\n--- PRJ-T11: Project Update Blocked for Engineer (403) ---');
    const engUpdateRes = await fetch(`${API_BASE}/projects/${createdProjectPM.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${engToken}`,
      },
      body: JSON.stringify({ name: 'Hacked by Engineer' }),
    });
    assert(engUpdateRes.status === 403, `Engineer update blocked with 403 Forbidden (got ${engUpdateRes.status})`);

    // =========================================================================
    // PRJ-T12: Project Deletion Blocked for Project Manager (403)
    // =========================================================================
    console.log('\n--- PRJ-T12: Project Deletion Blocked for Project Manager (403) ---');
    const pmDeleteRes = await fetch(`${API_BASE}/projects/${createdProjectPM.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${pmToken}` },
    });
    assert(pmDeleteRes.status === 403, `PM deletion blocked with 403 Forbidden (got ${pmDeleteRes.status})`);

    // =========================================================================
    // PRJ-T14: Nonexistent Project Deletion (404)
    // =========================================================================
    console.log('\n--- PRJ-T14: Nonexistent Project Deletion (404) ---');
    const nonExistentDeleteRes = await fetch(`${API_BASE}/projects/nonexistent-project-999`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(nonExistentDeleteRes.status === 404, `Delete nonexistent project returns 404 Not Found (got ${nonExistentDeleteRes.status})`);

    // =========================================================================
    // PRJ-T13: Project Deletion by Admin (DELETE /api/projects/:id)
    // =========================================================================
    console.log('\n--- PRJ-T13: Project Deletion by Admin (DELETE /api/projects/:id) ---');
    for (const pid of createdProjectIds) {
      const delRes = await fetch(`${API_BASE}/projects/${pid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(delRes.status === 200, `Admin successfully deletes project ${pid} (got ${delRes.status})`);
      const delBody = await delRes.json();
      assert(delBody.message.includes('permanently deleted'), 'Delete confirmation message returned');

      // Verify removal in PostgreSQL
      const dbCheck = await prisma.project.findUnique({ where: { id: pid } });
      assert(dbCheck === null, `Project ${pid} permanently removed from PostgreSQL`);
    }

    // =========================================================================
    // PRJ-T15: Unauthenticated Access Rejection (401 on all endpoints)
    // =========================================================================
    console.log('\n--- PRJ-T15: Unauthenticated Access Rejection (401 on all endpoints) ---');
    const noAuthList = await fetch(`${API_BASE}/projects`);
    assert(noAuthList.status === 401, `GET /api/projects without token returns 401 Unauthorized (got ${noAuthList.status})`);

    const noAuthGet = await fetch(`${API_BASE}/projects/INB`);
    assert(noAuthGet.status === 401, `GET /api/projects/:id without token returns 401 Unauthorized (got ${noAuthGet.status})`);

    const noAuthCreate = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'NOAUTH', name: 'No Auth' }),
    });
    assert(noAuthCreate.status === 401, `POST /api/projects without token returns 401 Unauthorized (got ${noAuthCreate.status})`);

    const noAuthUpdate = await fetch(`${API_BASE}/projects/INB`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'No Auth' }),
    });
    assert(noAuthUpdate.status === 401, `PATCH /api/projects/:id without token returns 401 Unauthorized (got ${noAuthUpdate.status})`);

    const noAuthDelete = await fetch(`${API_BASE}/projects/INB`, {
      method: 'DELETE',
    });
    assert(noAuthDelete.status === 401, `DELETE /api/projects/:id without token returns 401 Unauthorized (got ${noAuthDelete.status})`);

    // Clean up provisioned test users
    console.log('\n>>> Teardown: Cleaning up provisioned test users...');
    for (const uid of createdUserIds) {
      await fetch(`${API_BASE}/users/${uid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
    }

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`FINAL PROJECT TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runProjectsTestSuite();
