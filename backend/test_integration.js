const { PrismaClient } = require('@prisma/client');

const API_BASE = 'http://localhost:4000/api';
const prisma = new PrismaClient();

async function runTests() {
  console.log('================================================================');
  console.log('RUNNING VERIFICATION TEST SUITE: AUTH & USERS DB INTEGRATION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

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
    // Scenario 1: Admin logs in with valid database credentials
    // -------------------------------------------------------------------------
    console.log('--- Scenario 1: Admin login with valid credentials ---');
    const adminLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrId: 'tejas@inbox.GoldMine.io', password: 'admin123' }),
    });
    assert(adminLoginRes.status === 200 || adminLoginRes.status === 201, `Status is 200/201 (got ${adminLoginRes.status})`);
    const adminLoginData = await adminLoginRes.json();
    assert(!!adminLoginData.accessToken, 'Access token is present in login response');
    assert(adminLoginData.user?.role === 'Admin', `User role is Admin (got ${adminLoginData.user?.role})`);
    assert(!adminLoginData.user?.password, 'Password is NOT exposed in login response');
    const adminToken = adminLoginData.accessToken;

    // -------------------------------------------------------------------------
    // Scenario 2: Incorrect password is rejected
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 2: Incorrect password is rejected ---');
    const badPassRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrId: 'tejas@inbox.GoldMine.io', password: 'wrongpassword' }),
    });
    assert(badPassRes.status === 401, `Status is 401 Unauthorized (got ${badPassRes.status})`);
    const badPassData = await badPassRes.json();
    assert(
      badPassData.message === 'Invalid credentials. Please verify your email/ID and password.',
      `Consistent error message (got "${badPassData.message}")`
    );

    // -------------------------------------------------------------------------
    // Scenario 3: Unknown account is rejected
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 3: Unknown account is rejected ---');
    const unknownRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrId: 'nobody@nowhere.com', password: 'somepassword123' }),
    });
    assert(unknownRes.status === 401, `Status is 401 Unauthorized (got ${unknownRes.status})`);
    const unknownData = await unknownRes.json();
    assert(
      unknownData.message === 'Invalid credentials. Please verify your email/ID and password.',
      `Identical error message to prevent account enumeration (got "${unknownData.message}")`
    );

    // -------------------------------------------------------------------------
    // Scenario 4: Authenticated user can call /api/auth/me
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 4: Call GET /api/auth/me ---');
    const meRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(meRes.status === 200, `Status is 200 OK (got ${meRes.status})`);
    const meData = await meRes.json();
    assert(meData.id === 'user-1', `Correct user profile returned (got id ${meData.id})`);
    assert(meData.email === 'tejas@inbox.goldmine.io', `Correct email returned (got ${meData.email})`);
    assert(!meData.password, 'Password hash is NOT exposed in /auth/me');

    // -------------------------------------------------------------------------
    // Scenario 5: Admin creates a user (POST /api/users)
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 5: Admin creates a user through POST /api/users ---');
    const testEmail = `test.newuser.${Date.now()}@inbox.goldmine.io`;
    const testPassword = 'TestPassword123!';
    const createRes = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Automated Test User',
        email: testEmail,
        password: testPassword,
        role: 'Support_Agent',
        department: 'Customer Care',
        supportLevels: ['L1'],
        timezone: 'UTC',
        status: 'Active',
      }),
    });
    assert(createRes.status === 201, `Status is 201 Created (got ${createRes.status})`);
    const createdUserData = await createRes.json();
    assert(createdUserData.email === testEmail.toLowerCase(), `Created user email matches (got ${createdUserData.email})`);
    assert(!!createdUserData.id, `Created user has persistent database id: ${createdUserData.id}`);
    assert(!createdUserData.password, 'Created user response excludes password hash');
    const createdUserId = createdUserData.id;

    // -------------------------------------------------------------------------
    // Scenario 6: Verify the new user appears in PostgreSQL and Prisma Studio
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 6: Verify user in PostgreSQL via Prisma Client ---');
    const dbRecord = await prisma.user.findUnique({ where: { id: createdUserId } });
    assert(!!dbRecord, 'User record found in PostgreSQL database');
    assert(dbRecord.email === testEmail.toLowerCase(), 'Database record email matches');
    assert(dbRecord.password.startsWith('$2b$'), 'Password is stored as bcrypt hash ($2b$...)');
    assert(dbRecord.password !== testPassword, 'Plaintext password is NOT stored in PostgreSQL');

    // -------------------------------------------------------------------------
    // Scenario 7: The new user can log in with the correct password
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 7: New user logs in with database credentials ---');
    const newUserLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrId: testEmail, password: testPassword }),
    });
    assert(newUserLoginRes.status === 200 || newUserLoginRes.status === 201, `Status is 200/201 (got ${newUserLoginRes.status})`);
    const newUserLoginData = await newUserLoginRes.json();
    assert(!!newUserLoginData.accessToken, 'New user receives valid JWT accessToken');
    assert(newUserLoginData.user?.id === createdUserId, 'New user id in JWT session matches DB');
    const newUserToken = newUserLoginData.accessToken;

    // -------------------------------------------------------------------------
    // Scenario 8 & 9: User list is loaded from GET /api/users
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 8 & 9: Load user list from GET /api/users ---');
    const listRes = await fetch(`${API_BASE}/users?limit=50`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(listRes.status === 200, `Status is 200 OK (got ${listRes.status})`);
    const listData = await listRes.json();
    assert(Array.isArray(listData.data), 'User list returned as data array');
    assert(listData.total >= 9, `Total database users is at least 9 (got ${listData.total})`);
    const foundNewUser = listData.data.find((u) => u.id === createdUserId);
    assert(!!foundNewUser, 'Newly created user is visible in GET /api/users list (persists across reloads)');

    // -------------------------------------------------------------------------
    // Scenario 10: Unauthorized users cannot create or delete users
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 10: Unauthorized access restrictions (RBAC) ---');
    // Non-admin trying to create a user:
    const forbiddenCreateRes = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newUserToken}`, // Support_Agent role
      },
      body: JSON.stringify({
        name: 'Hacker',
        email: 'hacker@example.com',
        password: 'password12345',
        role: 'Admin',
        department: 'None',
      }),
    });
    assert(forbiddenCreateRes.status === 403, `Non-admin user creation blocked with 403 Forbidden (got ${forbiddenCreateRes.status})`);

    // Non-admin trying to delete a user:
    const forbiddenDeleteRes = await fetch(`${API_BASE}/users/${createdUserId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${newUserToken}` },
    });
    assert(forbiddenDeleteRes.status === 403, `Non-admin user deletion blocked with 403 Forbidden (got ${forbiddenDeleteRes.status})`);

    // Unauthenticated request:
    const unauthRes = await fetch(`${API_BASE}/users`, {
      method: 'GET',
    });
    assert(unauthRes.status === 401, `Unauthenticated request blocked with 401 Unauthorized (got ${unauthRes.status})`);

    // -------------------------------------------------------------------------
    // Scenario 11: Duplicate email handling follows database constraints
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 11: Duplicate email constraint enforcement ---');
    const duplicateRes = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Duplicate Email User',
        email: testEmail, // Already exists!
        password: 'AnotherPassword123',
        department: 'Customer Support',
      }),
    });
    assert(duplicateRes.status === 409, `Duplicate email rejected with 409 Conflict (got ${duplicateRes.status})`);
    const dupData = await duplicateRes.json();
    assert(dupData.message.includes('Unique constraint violation'), `Duplicate error explains violation (got "${dupData.message}")`);

    // -------------------------------------------------------------------------
    // Scenario 12: Admin updates user and password, then deletes user
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 12: Admin updates user, changes password, and deletes user ---');
    // Update user
    const updateRes = await fetch(`${API_BASE}/users/${createdUserId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: 'Automated Updated Name' }),
    });
    assert(updateRes.status === 200, `Update status is 200 (got ${updateRes.status})`);
    const updatedData = await updateRes.json();
    assert(updatedData.name === 'Automated Updated Name', `Name was updated to "${updatedData.name}"`);

    // Change password
    const newPassRes = await fetch(`${API_BASE}/users/${createdUserId}/password`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ newPassword: 'BrandNewPassword999!' }),
    });
    assert(newPassRes.status === 200, `Change password status is 200 (got ${newPassRes.status})`);

    // Verify login with new password
    const newPassLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrId: testEmail, password: 'BrandNewPassword999!' }),
    });
    assert(newPassLoginRes.status === 200 || newPassLoginRes.status === 201, 'Login succeeds with changed password');

    // Delete user
    const deleteRes = await fetch(`${API_BASE}/users/${createdUserId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(deleteRes.status === 200, `Delete status is 200 (got ${deleteRes.status})`);

    // Verify user is gone from DB
    const deletedDbRecord = await prisma.user.findUnique({ where: { id: createdUserId } });
    assert(deletedDbRecord === null, 'User is permanently removed from PostgreSQL');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
