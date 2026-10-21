import * as http from 'http';
import { PrismaClient, NotificationType, SprintStatus } from '@prisma/client';

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
            // keep raw string
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

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName} ${detail ? `- ${detail}` : ''}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('--- STARTING NOTIFICATIONS MODULE TESTS ---');

  // Obtain tokens for user-1 (Admin) and user-2 (Support Agent)
  const tokenUser1 = await login('user-1', 'admin123');
  const tokenUser2 = await login('user-2', 'support123');

  // Clean up any existing test notifications for user-1 and user-2
  await prisma.notification.deleteMany({
    where: {
      userId: { in: ['user-1', 'user-2'] },
    },
  });

  // 1. Unauthenticated requests are rejected (401)
  {
    const res = await request(`${API_BASE}/notifications`);
    assert(res.status === 401, '1. Unauthenticated GET /notifications returns 401 Unauthorized');
    assert(
      res.data?.message === 'Authentication required. Missing, invalid, or expired token.',
      '1b. 401 returns standardized exception message',
    );
  }

  // 2. Notification creation persists correctly in DB
  let notifUser1_1: any;
  let notifUser1_2: any;
  let notifUser2_1: any;

  {
    notifUser1_1 = await prisma.notification.create({
      data: {
        userId: 'user-1',
        title: 'System Alert',
        message: 'Database backup completed successfully.',
        type: NotificationType.system,
      },
    });

    notifUser1_2 = await prisma.notification.create({
      data: {
        userId: 'user-1',
        title: 'New Sprint Started',
        message: 'Sprint 2 has started.',
        type: NotificationType.sprint,
      },
    });

    notifUser2_1 = await prisma.notification.create({
      data: {
        userId: 'user-2',
        title: 'Ticket Assigned',
        message: 'You have been assigned INB-1002.',
        type: NotificationType.assignment,
        issueId: 'INB-1002',
      },
    });

    assert(!!notifUser1_1.id && !!notifUser2_1.id, '2. Notifications created directly in PostgreSQL');
  }

  // 3. Authenticated user can retrieve their notifications (user-1 gets only user-1 items)
  {
    const res = await request(`${API_BASE}/notifications`, {
      headers: { Authorization: `Bearer ${tokenUser1}` },
    });
    assert(res.status === 200, '3a. GET /notifications for user-1 returns 200 OK');
    assert(Array.isArray(res.data), '3b. Response is an array');
    assert(res.data.length === 2, '3c. User-1 receives exactly their 2 notifications');
    const allBelongToUser1 = res.data.every((n: any) => n.userId === 'user-1');
    assert(allBelongToUser1, '3d. All retrieved notifications have userId === user-1');
    // Verify newest first
    const date0 = new Date(res.data[0].createdAt).getTime();
    const date1 = new Date(res.data[1].createdAt).getTime();
    assert(date0 >= date1, '3e. Notifications are ordered newest first (createdAt DESC)');
  }

  // 4. User cannot retrieve another user's notifications (user-2 gets only user-2 items)
  {
    const res = await request(`${API_BASE}/notifications`, {
      headers: { Authorization: `Bearer ${tokenUser2}` },
    });
    assert(res.status === 200, '4a. GET /notifications for user-2 returns 200 OK');
    assert(res.data.length === 1, '4b. User-2 receives exactly their 1 notification');
    assert(res.data[0].id === notifUser2_1.id, '4c. User-2 received only their own notification');
    assert(res.data[0].userId === 'user-2', '4d. User isolation enforced on listing');
  }

  // 5. User can mark their own notification as read
  {
    const res = await request(`${API_BASE}/notifications/${notifUser1_1.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenUser1}` },
    });
    assert(res.status === 200, '5a. PATCH /notifications/:id/read returns 200 OK');
    assert(res.data.read === true, '5b. Returned notification has read === true');

    // Verify in database
    const dbItem = await prisma.notification.findUnique({ where: { id: notifUser1_1.id } });
    assert(dbItem?.read === true, '5c. Database record updated to read === true');
  }

  // 6. Idempotent mark-as-read: re-marking read notification returns 200 with read === true
  {
    const res = await request(`${API_BASE}/notifications/${notifUser1_1.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenUser1}` },
    });
    assert(res.status === 200, '6a. Re-marking already-read notification returns 200 OK');
    assert(res.data.read === true, '6b. read remains true');
  }

  // 7. User cannot mark another user's notification as read (returns 404 Not Found to prevent enumeration)
  {
    // user-1 tries to mark user-2's notification
    const res = await request(`${API_BASE}/notifications/${notifUser2_1.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenUser1}` },
    });
    assert(res.status === 404, '7a. Mutating another user notification returns 404 Not Found');

    // Verify user-2's notification was NOT modified
    const dbItem = await prisma.notification.findUnique({ where: { id: notifUser2_1.id } });
    assert(dbItem?.read === false, '7b. Other user notification remained read === false');
  }

  // 8. Missing notification returns 404
  {
    const fakeId = 'cmv_non_existent_cuid_99999';
    const res = await request(`${API_BASE}/notifications/${fakeId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenUser1}` },
    });
    assert(res.status === 404, '8. Missing notification ID returns 404 Not Found');
  }

  // 9. Mark-all-read affects only the authenticated user's unread notifications
  {
    // At this point:
    // user-1 has notifUser1_1 (read=true) and notifUser1_2 (read=false)
    // user-2 has notifUser2_1 (read=false)
    const res = await request(`${API_BASE}/notifications/mark-all-read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenUser1}` },
    });
    assert(res.status === 200, '9a. POST /notifications/mark-all-read returns 200 OK');
    assert(res.data.success === true, '9b. success is true');
    assert(res.data.count === 1, '9c. count is 1 (only notifUser1_2 was unread)');

    // Verify in database: user-1 notifications are all read=true
    const user1Notifs = await prisma.notification.findMany({ where: { userId: 'user-1' } });
    assert(user1Notifs.every((n) => n.read === true), '9d. All user-1 notifications are now read === true');

    // Verify user-2 notification is STILL read=false
    const user2Notif = await prisma.notification.findUnique({ where: { id: notifUser2_1.id } });
    assert(user2Notif?.read === false, '9e. User-2 notification was NOT updated by user-1 mark-all-read');
  }

  // 10. Sprint notification triggers (Sprint Start & Sprint Complete)
  {
    // Clean up or find test project
    let project = await prisma.project.findFirst({
      where: { key: 'INB' },
      include: { members: true },
    });

    if (project) {
      // Ensure user-2 is a member of the project for test
      const isMember = project.members.some((m) => m.id === 'user-2');
      if (!isMember) {
        await prisma.project.update({
          where: { id: project.id },
          data: { members: { connect: { id: 'user-2' } } },
        });
      }

      // Create a test sprint
      const now = new Date();
      const start = new Date(now.getTime() + 1000 * 60 * 60);
      const end = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7);

      const sprintRes = await request(
        `${API_BASE}/sprints`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenUser1}`,
          },
        },
        JSON.stringify({
          projectId: project.id,
          name: `Test Sprint Notif ${Date.now()}`,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        }),
      );

      if (sprintRes.status === 201) {
        const sprintId = sprintRes.data.id;

        // Clear user-2 notifications before start
        await prisma.notification.deleteMany({ where: { userId: 'user-2' } });

        // Start sprint with user-1
        // First ensure no other sprint is active in INB
        await prisma.sprint.updateMany({
          where: { projectId: project.id, status: SprintStatus.active },
          data: { status: SprintStatus.completed, completedDate: new Date() },
        });

        const startRes = await request(`${API_BASE}/sprints/${sprintId}/start`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenUser1}` },
        });
        assert(startRes.status === 200, '10a. SprintsService.start succeeds');

        // Check user-2 received a sprint notification
        const user2SprintNotifs = await prisma.notification.findMany({
          where: { userId: 'user-2', type: NotificationType.sprint },
        });
        assert(user2SprintNotifs.length >= 1, '10b. User-2 received sprint start notification');
        assert(
          user2SprintNotifs[0]?.title.includes('Sprint Started'),
          '10c. Notification title contains Sprint Started',
        );

        // Verify user-1 did NOT receive a self-notification (self-suppression)
        const user1SelfNotif = await prisma.notification.findFirst({
          where: {
            userId: 'user-1',
            title: user2SprintNotifs[0]?.title,
          },
        });
        assert(!user1SelfNotif, '10d. Self-notification was suppressed for actor (user-1)');

        // Now complete sprint with user-1
        const completeRes = await request(
          `${API_BASE}/sprints/${sprintId}/complete`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${tokenUser1}`,
            },
          },
          JSON.stringify({}),
        );
        assert(completeRes.status === 200, '10e. SprintsService.complete succeeds');

        // Check user-2 received sprint complete notification
        const user2CompleteNotifs = await prisma.notification.findMany({
          where: {
            userId: 'user-2',
            type: NotificationType.sprint,
            title: { contains: 'Sprint Completed' },
          },
        });
        assert(user2CompleteNotifs.length >= 1, '10f. User-2 received sprint completed notification');

        // Clean up test sprint
        await prisma.sprint.delete({ where: { id: sprintId } }).catch(() => {});
      }
    }
  }

  // 11. Foreign Key Cascade on User Deletion
  {
    // Create a temporary user with notification
    const tempUser = await prisma.user.create({
      data: {
        id: `temp-user-${Date.now()}`,
        name: 'Temp Test User',
        email: `temp-${Date.now()}@test.io`,
        password: 'hashed_dummy_password',
        role: 'Developer',
        department: 'Testing',
      },
    });

    const tempNotif = await prisma.notification.create({
      data: {
        userId: tempUser.id,
        title: 'Cascade Test',
        message: 'Should be deleted when user is deleted.',
      },
    });

    // Delete user
    await prisma.user.delete({ where: { id: tempUser.id } });

    // Notification should be cascaded by PostgreSQL
    const checkNotif = await prisma.notification.findUnique({ where: { id: tempNotif.id } });
    assert(checkNotif === null, '11. Notification deleted via CASCADE when owning user is deleted');
  }

  console.log(`\nRESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  await prisma.$disconnect();

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  prisma.$disconnect();
  process.exit(1);
});
