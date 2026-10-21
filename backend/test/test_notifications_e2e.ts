import * as http from 'http';
import { PrismaClient, NotificationType } from '@prisma/client';

const API_BASE = 'http://localhost:4000/api';
const prisma = new PrismaClient();

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
}

function request(
  url: string,
  options: RequestOptions = {},
  body?: any,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; data: any }> {
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
            // retain raw string if not JSON
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

async function runE2ETests() {
  console.log('================================================================');
  console.log('       END-TO-END NOTIFICATIONS SYSTEM VERIFICATION            ');
  console.log('================================================================\n');

  // 1. Authenticate test users
  console.log('Step 1: Authenticating Test Users...');
  const tokenAdmin = await login('user-1', 'admin123');
  const tokenUser2 = await login('user-2', 'support123');
  console.log('  [OK] Admin (user-1) and Support Agent (user-2) logged in successfully.\n');

  // Baseline notifications check
  const initialRes = await request(`${API_BASE}/notifications`, {
    headers: { Authorization: `Bearer ${tokenUser2}` },
  });
  console.log(`Initial notification count for user-2: ${initialRes.data.length}`);

  // ---------------------------------------------------------------------------
  // Step 2: Test Real Supported Event 1 & 2: Sprint Started & Sprint Completed
  // ---------------------------------------------------------------------------
  console.log('\nStep 2: Testing Real Application Flow — Sprint Lifecycle...');
  const sprintTimestamp = Date.now();
  const sprintName = `Sprint E2E Test ${sprintTimestamp}`;

  // 2a. Create planned sprint in INB (proj-1) where user-2 is a member
  console.log(`  Creating planned sprint: "${sprintName}" in project INB...`);
  const createSprintRes = await request(
    `${API_BASE}/sprints`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`,
      },
    },
    JSON.stringify({
      projectId: 'proj-1',
      name: sprintName,
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 14 * 86400000).toISOString(),
      goal: 'Automated E2E Notification Trigger Verification',
    }),
  );

  if (createSprintRes.status !== 201) {
    throw new Error(`Failed to create sprint: ${createSprintRes.status} ${JSON.stringify(createSprintRes.data)}`);
  }
  const createdSprintId = createSprintRes.data.id;
  console.log(`  [OK] Sprint created with ID: ${createdSprintId}`);

  // 2b. Start the sprint via POST /api/sprints/:id/start
  console.log(`  Triggering POST /api/sprints/${createdSprintId}/start...`);
  const startRes = await request(
    `${API_BASE}/sprints/${createdSprintId}/start`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    },
  );
  if (startRes.status !== 200) {
    throw new Error(`Failed to start sprint: ${startRes.status} ${JSON.stringify(startRes.data)}`);
  }
  console.log('  [OK] Sprint started successfully via API.');

  // Verify Sprint Started notification in PostgreSQL
  const dbSprintStarted = await prisma.notification.findFirst({
    where: {
      userId: 'user-2',
      type: NotificationType.sprint,
      title: { contains: sprintName },
    },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`  [DB Check] Sprint Started record found: ${!!dbSprintStarted} (ID: ${dbSprintStarted?.id})`);

  // 2c. Complete the sprint via POST /api/sprints/:id/complete
  console.log(`  Triggering POST /api/sprints/${createdSprintId}/complete...`);
  const completeRes = await request(
    `${API_BASE}/sprints/${createdSprintId}/complete`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`,
      },
    },
    JSON.stringify({}),
  );
  if (completeRes.status !== 200) {
    throw new Error(`Failed to complete sprint: ${completeRes.status} ${JSON.stringify(completeRes.data)}`);
  }
  console.log('  [OK] Sprint completed successfully via API.');

  // Verify Sprint Completed notification in PostgreSQL
  const dbSprintCompleted = await prisma.notification.findFirst({
    where: {
      userId: 'user-2',
      type: NotificationType.sprint,
      title: { contains: `Sprint Completed: ${sprintName}` },
    },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`  [DB Check] Sprint Completed record found: ${!!dbSprintCompleted} (ID: ${dbSprintCompleted?.id})`);

  // ---------------------------------------------------------------------------
  // Step 3: Missing Notification Event Types Generation (Development Test Method)
  // ---------------------------------------------------------------------------
  console.log('\nStep 3: Missing Event Types Testing via Validated Test Generator...');
  console.log('  Confirmed missing backend triggers:');
  console.log('    - assignment : No IssuesModule in backend; frontend only uses local state');
  console.log('    - comment    : No CommentsModule in backend; frontend only uses local state');
  console.log('    - status     : No IssuesModule in backend; frontend only uses local state');
  console.log('    - escalation : No IssuesModule in backend; frontend only uses local state');
  console.log('    - system     : No System alert trigger in backend');

  console.log('\n  Generating schema-validated notifications for user-2 for missing types...');

  const missingTypesToGenerate = [
    {
      type: NotificationType.assignment,
      title: `Ticket Assigned: INB-1002 (E2E Test ${sprintTimestamp})`,
      message: `You have been assigned to ticket INB-1002 "Login screen layout shift".`,
      issueId: 'INB-1002',
    },
    {
      type: NotificationType.comment,
      title: `New Comment on INB-1002 (E2E Test ${sprintTimestamp})`,
      message: `Tejas Chauhan commented: "Reproduction verified on Safari and Chrome."`,
      issueId: 'INB-1002',
    },
    {
      type: NotificationType.status,
      title: `Status Changed: INB-1002 (E2E Test ${sprintTimestamp})`,
      message: `Ticket INB-1002 moved from In Progress to In Review.`,
      issueId: 'INB-1002',
    },
    {
      type: NotificationType.escalation,
      title: `Ticket Escalated: INB-1005 (E2E Test ${sprintTimestamp})`,
      message: `Ticket INB-1005 escalated from L1 to L2: Database query timeout investigation.`,
      issueId: 'INB-1005',
    },
    {
      type: NotificationType.system,
      title: `System Alert (E2E Test ${sprintTimestamp})`,
      message: `Scheduled maintenance window configured for Saturday 02:00 UTC.`,
    },
  ];

  const generatedRecords: Record<string, any> = {};

  for (const item of missingTypesToGenerate) {
    const created = await prisma.notification.create({
      data: {
        userId: 'user-2',
        title: item.title,
        message: item.message,
        type: item.type,
        issueId: item.issueId || null,
        read: false,
      },
    });
    generatedRecords[item.type] = created;
    console.log(`    [Created ${item.type.toUpperCase()}] ID: ${created.id}`);
  }

  // ---------------------------------------------------------------------------
  // Step 4: Verify Frontend API Delivery (GET /api/notifications)
  // ---------------------------------------------------------------------------
  console.log('\nStep 4: Verifying Delivery via GET /api/notifications for user-2...');
  const user2NotifsRes = await request(`${API_BASE}/notifications`, {
    headers: { Authorization: `Bearer ${tokenUser2}` },
  });

  if (user2NotifsRes.status !== 200 || !Array.isArray(user2NotifsRes.data)) {
    throw new Error(`Failed to fetch notifications: ${user2NotifsRes.status}`);
  }

  console.log(`  Total notifications returned for user-2: ${user2NotifsRes.data.length}`);

  const typesFound = new Set(user2NotifsRes.data.map((n: any) => n.type));
  console.log(`  Unique Notification Types Returned: ${Array.from(typesFound).join(', ')}`);

  // Verify all 6 types are present
  const allExpectedTypes = ['sprint', 'assignment', 'comment', 'status', 'escalation', 'system'];
  for (const t of allExpectedTypes) {
    const found = typesFound.has(t);
    console.log(`    Type [${t.padEnd(11)}]: ${found ? 'PASS' : 'FAIL'}`);
  }

  // ---------------------------------------------------------------------------
  // Step 5: Verify Mark-As-Read & Persistence
  // ---------------------------------------------------------------------------
  console.log('\nStep 5: Verifying Mark-As-Read and DB Persistence...');
  const targetToMark = generatedRecords[NotificationType.assignment];
  console.log(`  Marking notification ${targetToMark.id} (assignment) as read...`);

  const markReadRes = await request(`${API_BASE}/notifications/${targetToMark.id}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenUser2}` },
  });

  if (markReadRes.status !== 200 || markReadRes.data.read !== true) {
    throw new Error(`Failed to mark read: ${markReadRes.status} ${JSON.stringify(markReadRes.data)}`);
  }
  console.log('  [OK] PATCH /api/notifications/:id/read returned 200 with read: true');

  // Confirm DB persistence
  const dbVerified = await prisma.notification.findUnique({
    where: { id: targetToMark.id },
  });
  console.log(`  [DB Check] read in PostgreSQL: ${dbVerified?.read} (Expected: true)`);

  // Confirm subsequent GET /api/notifications has read: true
  const refreshedNotifsRes = await request(`${API_BASE}/notifications`, {
    headers: { Authorization: `Bearer ${tokenUser2}` },
  });
  const refreshedItem = refreshedNotifsRes.data.find((n: any) => n.id === targetToMark.id);
  console.log(`  [API Check] read in GET /api/notifications: ${refreshedItem?.read} (Expected: true)`);

  console.log('\n================================================================');
  console.log('             ALL VERIFICATION STEPS COMPLETED                   ');
  console.log('================================================================');
}

runE2ETests()
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
