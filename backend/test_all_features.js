const { PrismaClient } = require('@prisma/client');

const API_BASE = 'http://localhost:4000/api';
const prisma = new PrismaClient();

async function runAuditTests() {
  console.log('================================================================');
  console.log('AUDIT & VERIFICATION SUITE: 6 USER MANAGEMENT MODULE FEATURES');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;
  const testUsersCreated = [];

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
    // Setup: Get Admin token and Non-Admin token
    // -------------------------------------------------------------------------
    console.log('>>> Setup: Authenticating Admin and Non-Admin users...');
    const adminLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrId: 'tejas@inbox.GoldMine.io', password: 'admin123' }),
    });
    assert(adminLoginRes.status === 200, `Admin logged in successfully (${adminLoginRes.status})`);
    const adminData = await adminLoginRes.json();
    const adminToken = adminData.accessToken;
    const adminId = adminData.user.id;

    // Login non-admin: Rahul Sharma (Support_Agent)
    const agentLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrId: 'rahul.s@inbox.GoldMine.io', password: 'support123' }),
    });
    assert(agentLoginRes.status === 200, `Support Agent logged in successfully (${agentLoginRes.status})`);
    const agentData = await agentLoginRes.json();
    const agentToken = agentData.accessToken;
    const agentId = agentData.user.id;

    // =========================================================================
    // FEATURE 1: GET ALL USERS (GET /api/users)
    // =========================================================================
    console.log('\n--- [FEATURE 1] GET /api/users (Get All Users) ---');

    // 1.1 Successful list retrieval (Admin)
    const listRes = await fetch(`${API_BASE}/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(listRes.status === 200, `List users returns 200 OK (got ${listRes.status})`);
    const listData = await listRes.json();
    assert(Array.isArray(listData.data), 'Returns data array');
    assert(typeof listData.total === 'number' && listData.total > 0, `Total count returned (${listData.total})`);
    assert(listData.data.every(u => !u.password), 'Passwords and hashes are never exposed in user list');

    // 1.2 Accessible by non-admin authenticated users
    const agentListRes = await fetch(`${API_BASE}/users`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    assert(agentListRes.status === 200, `Support Agent can view user list (got ${agentListRes.status})`);

    // 1.3 Query parameter filtering (role)
    const roleFilterRes = await fetch(`${API_BASE}/users?role=Support_Agent`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(roleFilterRes.status === 200, `Filter by role returns 200 OK (got ${roleFilterRes.status})`);
    const roleFilterData = await roleFilterRes.json();
    assert(roleFilterData.data.every(u => u.role === 'Support_Agent'), 'All filtered users have Support_Agent role');

    // 1.4 Search query parameter (name/email match)
    const searchRes = await fetch(`${API_BASE}/users?search=tejas`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(searchRes.status === 200, `Search users returns 200 OK (got ${searchRes.status})`);
    const searchData = await searchRes.json();
    assert(searchData.data.some(u => u.name.toLowerCase().includes('tejas') || u.email.toLowerCase().includes('tejas')), 'Search results match query');

    // 1.5 Pagination (page & limit up to 200)
    const pageRes = await fetch(`${API_BASE}/users?page=1&limit=200`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(pageRes.status === 200, `Large limit (?limit=200) accepted cleanly (got ${pageRes.status})`);

    // 1.6 Unauthorized access (missing JWT)
    const noAuthListRes = await fetch(`${API_BASE}/users`);
    assert(noAuthListRes.status === 401, `GET /api/users without token returns 401 Unauthorized (got ${noAuthListRes.status})`);

    // =========================================================================
    // FEATURE 2: GET USER BY ID (GET /api/users/:id)
    // =========================================================================
    console.log('\n--- [FEATURE 2] GET /api/users/:id (Get User by ID) ---');

    // 2.1 Retrieve specific user by ID
    const getUserRes = await fetch(`${API_BASE}/users/${adminId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(getUserRes.status === 200, `GET user by ID returns 200 OK (got ${getUserRes.status})`);
    const fetchedUser = await getUserRes.json();
    assert(fetchedUser.id === adminId, `Retrieved user ID matches (${fetchedUser.id})`);
    assert(fetchedUser.email === 'tejas@inbox.goldmine.io', `Email matches (${fetchedUser.email})`);
    assert(!fetchedUser.password, 'Password and hash are NOT exposed');

    // 2.2 Nonexistent user handling
    const nonExistentRes = await fetch(`${API_BASE}/users/nonexistent-id-999`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(nonExistentRes.status === 404, `GET nonexistent user returns 404 Not Found (got ${nonExistentRes.status})`);
    const nonExistentData = await nonExistentRes.json();
    assert(nonExistentData.message.includes('not found'), `404 message indicates user not found: "${nonExistentData.message}"`);

    // 2.3 Non-admin can view user details
    const agentGetUserRes = await fetch(`${API_BASE}/users/${adminId}`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    assert(agentGetUserRes.status === 200, `Non-admin can view user by ID (got ${agentGetUserRes.status})`);

    // 2.4 Unauthorized access without token
    const noAuthGetUserRes = await fetch(`${API_BASE}/users/${adminId}`);
    assert(noAuthGetUserRes.status === 401, `GET user by ID without token returns 401 Unauthorized (got ${noAuthGetUserRes.status})`);

    // =========================================================================
    // FEATURE 3: CREATE USER (POST /api/users)
    // =========================================================================
    console.log('\n--- [FEATURE 3] POST /api/users (Create User) ---');

    // 3.1 Successful creation by Admin
    const testEmail = `audit.user.${Date.now()}@inbox.goldmine.io`;
    const testPassword = 'InitialSecurePass123!';
    const createRes = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Audit Test Account',
        email: testEmail,
        password: testPassword,
        role: 'Developer',
        department: 'Engineering Quality',
        supportLevels: ['L2'],
        timezone: 'UTC+05:30 (IST)',
        status: 'Active',
      }),
    });
    assert(createRes.status === 201, `Create user returns 201 Created (got ${createRes.status})`);
    const createdUser = await createRes.json();
    assert(createdUser.id, `Created user has persistent ID (${createdUser.id})`);
    assert(createdUser.email === testEmail.toLowerCase(), 'Created user email matches');
    assert(!createdUser.password, 'Created user response excludes password hash');
    testUsersCreated.push(createdUser.id);

    // Verify password was hashed in PostgreSQL
    const createdDbUser = await prisma.user.findUnique({ where: { id: createdUser.id } });
    assert(createdDbUser.password.startsWith('$2b$'), 'Password is encrypted with bcrypt ($2b$...) in DB');
    assert(createdDbUser.password !== testPassword, 'Plaintext password is never stored in DB');

    // 3.2 Duplicate email conflict (409)
    const duplicateRes = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Duplicate Account',
        email: testEmail,
        password: 'AnotherPassword123!',
        department: 'Operations',
      }),
    });
    assert(duplicateRes.status === 409, `Duplicate email returns 409 Conflict (got ${duplicateRes.status})`);

    // 3.3 Invalid input: password too short (< 8 chars)
    const shortPassRes = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Short Pass User',
        email: `shortpass.${Date.now()}@test.io`,
        password: 'short',
        department: 'Operations',
      }),
    });
    assert(shortPassRes.status === 400, `Short password rejected with 400 Bad Request (got ${shortPassRes.status})`);

    // 3.4 Invalid input: invalid email format
    const badEmailRes = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Bad Email User',
        email: 'not-an-email',
        password: 'ValidPassword123!',
        department: 'Operations',
      }),
    });
    assert(badEmailRes.status === 400, `Malformed email rejected with 400 Bad Request (got ${badEmailRes.status})`);

    // 3.5 Unauthorized access: Non-Admin creation attempt (403)
    const nonAdminCreateRes = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify({
        name: 'Agent Spawned User',
        email: `unauth.${Date.now()}@test.io`,
        password: 'ValidPassword123!',
        department: 'Operations',
      }),
    });
    assert(nonAdminCreateRes.status === 403, `Non-admin user creation blocked with 403 Forbidden (got ${nonAdminCreateRes.status})`);

    // 3.6 Unauthenticated creation attempt (401)
    const noAuthCreateRes = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'No Auth User',
        email: `noauth.${Date.now()}@test.io`,
        password: 'ValidPassword123!',
        department: 'Operations',
      }),
    });
    assert(noAuthCreateRes.status === 401, `Unauthenticated user creation blocked with 401 Unauthorized (got ${noAuthCreateRes.status})`);

    // =========================================================================
    // FEATURE 4: UPDATE USER (PATCH /api/users/:id)
    // =========================================================================
    console.log('\n--- [FEATURE 4] PATCH /api/users/:id (Update User) ---');

    // 4.1 Successful update by Admin
    const updateRes = await fetch(`${API_BASE}/users/${createdUser.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Updated Audit Account Name',
        department: 'Advanced Engineering',
        status: 'Away',
      }),
    });
    assert(updateRes.status === 200, `Admin update returns 200 OK (got ${updateRes.status})`);
    const updatedUser = await updateRes.json();
    assert(updatedUser.name === 'Updated Audit Account Name', `Name updated to "${updatedUser.name}"`);
    assert(updatedUser.department === 'Advanced Engineering', `Department updated to "${updatedUser.department}"`);
    assert(updatedUser.status === 'Away', `Status updated to "${updatedUser.status}"`);

    // 4.2 Nonexistent user update handling (404)
    const updateNonexistentRes = await fetch(`${API_BASE}/users/nonexistent-id-999`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: 'Ghost' }),
    });
    assert(updateNonexistentRes.status === 404, `Update nonexistent user returns 404 Not Found (got ${updateNonexistentRes.status})`);

    // 4.3 Non-admin attempting to update another user (403)
    const updateOtherRes = await fetch(`${API_BASE}/users/${createdUser.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify({ name: 'Tampered Name' }),
    });
    assert(updateOtherRes.status === 403, `Non-admin updating another user blocked with 403 Forbidden (got ${updateOtherRes.status})`);

    // 4.4 Non-admin updating self is permitted for profile fields
    const selfUpdateRes = await fetch(`${API_BASE}/users/${agentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify({ timezone: 'UTC+05:30 (IST)' }),
    });
    assert(selfUpdateRes.status === 200, `Non-admin can update own profile fields (got ${selfUpdateRes.status})`);

    // 4.5 Non-admin attempting to change their own role (403)
    const selfRoleChangeRes = await fetch(`${API_BASE}/users/${agentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify({ role: 'Admin' }),
    });
    assert(selfRoleChangeRes.status === 403, `Non-admin cannot elevate own role to Admin (got ${selfRoleChangeRes.status})`);

    // 4.6 Unauthenticated update attempt (401)
    const noAuthUpdateRes = await fetch(`${API_BASE}/users/${createdUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'No Auth' }),
    });
    assert(noAuthUpdateRes.status === 401, `Unauthenticated update blocked with 401 Unauthorized (got ${noAuthUpdateRes.status})`);

    // =========================================================================
    // FEATURE 6: CHANGE PASSWORD (PATCH /api/users/:id/password)
    // (Tested before deleting the test user)
    // =========================================================================
    console.log('\n--- [FEATURE 6] PATCH /api/users/:id/password (Change Password) ---');

    // 6.1 Admin can reset any user's password without knowing current password
    const adminResetPassRes = await fetch(`${API_BASE}/users/${createdUser.id}/password`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ newPassword: 'AdminAssignedNewPass456!' }),
    });
    assert(adminResetPassRes.status === 200, `Admin reset password returns 200 OK (got ${adminResetPassRes.status})`);
    const resetMsg = await adminResetPassRes.json();
    assert(resetMsg.message === 'Password updated successfully.', `Success message returned: "${resetMsg.message}"`);

    // Verify the user can log in with the new password
    const testUserLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrId: testEmail, password: 'AdminAssignedNewPass456!' }),
    });
    assert(testUserLoginRes.status === 200, `User logs in with Admin-reset password (got ${testUserLoginRes.status})`);
    const testUserData = await testUserLoginRes.json();
    const testUserToken = testUserData.accessToken;

    // 6.2 Self-service password change: requires correct currentPassword
    const selfChangePassRes = await fetch(`${API_BASE}/users/${createdUser.id}/password`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testUserToken}`,
      },
      body: JSON.stringify({
        currentPassword: 'AdminAssignedNewPass456!',
        newPassword: 'SelfChangedSecurePass789!',
        confirmPassword: 'SelfChangedSecurePass789!',
      }),
    });
    assert(selfChangePassRes.status === 200, `Self-service password change returns 200 OK (got ${selfChangePassRes.status})`);

    // Verify login with self-changed password
    const testUserLogin2Res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrId: testEmail, password: 'SelfChangedSecurePass789!' }),
    });
    assert(testUserLogin2Res.status === 200, `User logs in with self-changed password (got ${testUserLogin2Res.status})`);

    // 6.3 Self-service password change with INCORRECT currentPassword rejected (400)
    const badCurrentPassRes = await fetch(`${API_BASE}/users/${createdUser.id}/password`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testUserToken}`,
      },
      body: JSON.stringify({
        currentPassword: 'WrongCurrentPassword!',
        newPassword: 'AnotherNewPass123!',
      }),
    });
    assert(badCurrentPassRes.status === 400, `Incorrect current password rejected with 400 Bad Request (got ${badCurrentPassRes.status})`);
    const badPassMsg = await badCurrentPassRes.json();
    assert(badPassMsg.message === 'Current password is incorrect.', `Clear error message: "${badPassMsg.message}"`);

    // 6.4 Password mismatch (newPassword !== confirmPassword)
    const mismatchPassRes = await fetch(`${API_BASE}/users/${createdUser.id}/password`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testUserToken}`,
      },
      body: JSON.stringify({
        currentPassword: 'SelfChangedSecurePass789!',
        newPassword: 'PasswordOne123!',
        confirmPassword: 'PasswordDifferent456!',
      }),
    });
    assert(mismatchPassRes.status === 400, `Mismatched passwords rejected with 400 Bad Request (got ${mismatchPassRes.status})`);

    // 6.5 New password too short (< 8 chars)
    const shortNewPassRes = await fetch(`${API_BASE}/users/${createdUser.id}/password`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testUserToken}`,
      },
      body: JSON.stringify({
        currentPassword: 'SelfChangedSecurePass789!',
        newPassword: 'short',
      }),
    });
    assert(shortNewPassRes.status === 400, `Short new password rejected with 400 Bad Request (got ${shortNewPassRes.status})`);

    // 6.6 Non-admin attempting to reset ANOTHER user's password (403)
    const unauthPassResetRes = await fetch(`${API_BASE}/users/${adminId}/password`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify({ newPassword: 'HackedAdminPass123!' }),
    });
    assert(unauthPassResetRes.status === 403, `Non-admin resetting another password blocked with 403 Forbidden (got ${unauthPassResetRes.status})`);

    // 6.7 Nonexistent user password change (404)
    const nonExistentPassRes = await fetch(`${API_BASE}/users/nonexistent-id-999/password`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ newPassword: 'ValidPassword123!' }),
    });
    assert(nonExistentPassRes.status === 404, `Password change for nonexistent user returns 404 Not Found (got ${nonExistentPassRes.status})`);

    // 6.8 Unauthenticated password change (401)
    const noAuthPassRes = await fetch(`${API_BASE}/users/${createdUser.id}/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: 'ValidPassword123!' }),
    });
    assert(noAuthPassRes.status === 401, `Unauthenticated password change returns 401 Unauthorized (got ${noAuthPassRes.status})`);

    // =========================================================================
    // FEATURE 5: DELETE USER (DELETE /api/users/:id)
    // =========================================================================
    console.log('\n--- [FEATURE 5] DELETE /api/users/:id (Delete User) ---');

    // 5.1 Self-deletion protection: Admin cannot delete their own account
    const selfDeleteRes = await fetch(`${API_BASE}/users/${adminId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(selfDeleteRes.status === 400, `Self-deletion blocked with 400 Bad Request (got ${selfDeleteRes.status})`);
    const selfDeleteMsg = await selfDeleteRes.json();
    assert(selfDeleteMsg.message.includes('cannot delete your own account'), `Protection message: "${selfDeleteMsg.message}"`);

    // 5.2 Non-Admin cannot delete user accounts (403)
    const nonAdminDeleteRes = await fetch(`${API_BASE}/users/${createdUser.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    assert(nonAdminDeleteRes.status === 403, `Non-admin user deletion blocked with 403 Forbidden (got ${nonAdminDeleteRes.status})`);

    // 5.3 Nonexistent user deletion handling (404)
    const nonexistentDeleteRes = await fetch(`${API_BASE}/users/nonexistent-id-999`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(nonexistentDeleteRes.status === 404, `Delete nonexistent user returns 404 Not Found (got ${nonexistentDeleteRes.status})`);

    // 5.4 Unauthenticated deletion attempt (401)
    const noAuthDeleteRes = await fetch(`${API_BASE}/users/${createdUser.id}`, {
      method: 'DELETE',
    });
    assert(noAuthDeleteRes.status === 401, `Unauthenticated deletion blocked with 401 Unauthorized (got ${noAuthDeleteRes.status})`);

    // 5.5 Successful deletion by Admin
    const deleteRes = await fetch(`${API_BASE}/users/${createdUser.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(deleteRes.status === 200, `Admin delete returns 200 OK (got ${deleteRes.status})`);
    const deleteMsg = await deleteRes.json();
    assert(deleteMsg.message.includes('permanently deleted'), `Success message: "${deleteMsg.message}"`);

    // Verify user is gone from PostgreSQL
    const deletedDbUser = await prisma.user.findUnique({ where: { id: createdUser.id } });
    assert(deletedDbUser === null, 'User record is completely removed from PostgreSQL');

    // Verify user cannot log in after deletion
    const loginAfterDeleteRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrId: testEmail, password: 'SelfChangedSecurePass789!' }),
    });
    assert(loginAfterDeleteRes.status === 401, `Deleted user cannot log in (got ${loginAfterDeleteRes.status})`);

    // Verify user is no longer in GET /api/users list
    const finalListRes = await fetch(`${API_BASE}/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const finalList = await finalListRes.json();
    assert(!finalList.data.some(u => u.id === createdUser.id), 'Deleted user is no longer returned in GET /api/users');

  } catch (err) {
    console.error('Test error:', err);
    failed++;
  } finally {
    // Cleanup any test accounts created during test
    for (const testId of testUsersCreated) {
      try {
        await prisma.user.deleteMany({ where: { id: testId } });
      } catch {}
    }
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`FINAL TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAuditTests();
