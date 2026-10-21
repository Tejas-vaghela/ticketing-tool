const BASE_URL = 'http://localhost:4000/api';

async function request(path: string, options: any = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const body = options.body ? JSON.stringify(options.body) : undefined;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body,
  });

  const contentType = res.headers.get('content-type') || '';
  let data: any = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return {
    status: res.status,
    ok: res.ok,
    data,
  };
}

async function runTests() {
  console.log('================================================================');
  console.log('STARTING END-TO-END NOTIFICATION TRIGGERS & 404 VERIFICATION');
  console.log('================================================================\n');

  let passedCount = 0;
  let totalTests = 0;

  function assert(condition: boolean, msg: string) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] ${msg}`);
      passedCount++;
    } else {
      console.error(`  [FAIL] ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  // 1. Authenticate users
  console.log('1. Authenticating Admin (user-1) and Support Agent (user-2)...');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: {
      emailOrId: 'tejas@inbox.GoldMine.io',
      password: 'admin123',
    },
  });
  assert(adminLogin.status === 200, 'Admin login returned 200');
  const adminToken = adminLogin.data.accessToken;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  assert(!!adminToken, 'Admin received JWT token');

  const user2Login = await request('/auth/login', {
    method: 'POST',
    body: {
      emailOrId: 'rahul.s@inbox.GoldMine.io',
      password: 'support123',
    },
  });
  assert(user2Login.status === 200, 'User 2 (Rahul Sharma) login returned 200');
  const user2Token = user2Login.data.accessToken;
  const user2Headers = { Authorization: `Bearer ${user2Token}` };
  assert(!!user2Token, 'User 2 received JWT token');

  const user3Login = await request('/auth/login', {
    method: 'POST',
    body: {
      emailOrId: 'priya.p@inbox.GoldMine.io',
      password: 'tech123',
    },
  });
  assert(user3Login.status === 200, 'User 3 (Priya Patel) login returned 200');
  const user3Token = user3Login.data.accessToken;
  const user3Headers = { Authorization: `Bearer ${user3Token}` };
  assert(!!user3Token, 'User 3 received JWT token');

  // 2. Test Assignment Notification Trigger
  console.log('\n2. Testing Ticket Assignment Trigger...');
  const assignRes = await request('/issues/INB-1002', {
    method: 'PATCH',
    headers: adminHeaders,
    body: { assigneeId: 'user-2' },
  });
  assert(assignRes.status === 200, 'Issue INB-1002 reassigned to user-2 successfully');

  // Check user-2 notifications
  const user2Notifs1 = await request('/notifications', { headers: user2Headers });
  assert(user2Notifs1.status === 200, 'GET /api/notifications returns 200 for user-2');
  const assignNotif = user2Notifs1.data.find(
    (n: any) => n.type === 'assignment' && n.issueId === 'INB-1002',
  );
  assert(!!assignNotif, `Found assignment notification for user-2: "${assignNotif?.title}"`);

  // 3. Test Status Change Notification Trigger
  console.log('\n3. Testing Issue Status Change Trigger...');
  const statusRes = await request('/issues/INB-1002/status', {
    method: 'PATCH',
    headers: adminHeaders,
    body: { status: 'In Progress' },
  });
  assert(statusRes.status === 200, 'Status of INB-1002 changed to "In Progress"');

  const user2Notifs2 = await request('/notifications', { headers: user2Headers });
  const statusNotif = user2Notifs2.data.find(
    (n: any) => n.type === 'status' && n.issueId === 'INB-1002',
  );
  assert(!!statusNotif, `Found status change notification for user-2: "${statusNotif?.title}"`);

  // 4. Test Comment Notification Trigger
  console.log('\n4. Testing Issue Comment Trigger...');
  const commentRes = await request('/issues/INB-1002/comments', {
    method: 'POST',
    headers: adminHeaders,
    body: { content: 'Automated test comment: Check Redis connection pool.', type: 'public' },
  });
  assert(commentRes.status === 201, 'Comment added to INB-1002 successfully');

  const user2Notifs3 = await request('/notifications', { headers: user2Headers });
  const commentNotif = user2Notifs3.data.find(
    (n: any) => n.type === 'comment' && n.issueId === 'INB-1002',
  );
  assert(!!commentNotif, `Found comment notification for user-2: "${commentNotif?.title}"`);

  // 5. Test Escalation Trigger
  console.log('\n5. Testing Issue Escalation Trigger...');
  const escalateRes = await request('/issues/INB-1002/escalate', {
    method: 'POST',
    headers: user2Headers,
    body: {
      toLevel: 'L2',
      reason: 'Memory leak detected in queue worker',
      assignedToUserId: 'user-3',
    },
  });
  assert(
    escalateRes.status === 200 || escalateRes.status === 201,
    'Issue INB-1002 escalated to L2 and assigned to user-3',
  );

  const user3Notifs = await request('/notifications', { headers: user3Headers });
  const escalateNotif = user3Notifs.data.find(
    (n: any) => n.type === 'escalation' && n.issueId === 'INB-1002',
  );
  assert(!!escalateNotif, `Found escalation notification for user-3: "${escalateNotif?.title}"`);

  // 6. Test Sprint Notifications (Started & Completed)
  console.log('\n6. Testing Sprint Notifications Trigger...');
  const projectsRes = await request('/projects', { headers: adminHeaders });
  const inbProject = projectsRes.data[0];

  // Ensure user-2 is a member of the project so user-2 receives sprint notifications
  await request(`/projects/${inbProject.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: { memberIds: ['user-1', 'user-2', 'user-3'] },
  });

  const sprintRes = await request('/sprints', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      projectId: inbProject.id,
      name: `Sprint E2E Test ${Date.now()}`,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 86400000).toISOString(),
      goal: 'Verify sprint notification triggers',
    },
  });
  const sprintId = sprintRes.data.id;
  assert(!!sprintId, `Created test sprint ${sprintId}`);

  const startSprintRes = await request(`/sprints/${sprintId}/start`, {
    method: 'POST',
    headers: adminHeaders,
  });
  assert(startSprintRes.status === 200, `Started sprint ${sprintId}`);

  const completeSprintRes = await request(`/sprints/${sprintId}/complete`, {
    method: 'POST',
    headers: adminHeaders,
  });
  assert(completeSprintRes.status === 200, `Completed sprint ${sprintId}`);

  const user2NotifsSprint = await request('/notifications', { headers: user2Headers });
  const sprintNotif = user2NotifsSprint.data.find(
    (n: any) => n.type === 'sprint' && (n.message.includes(sprintRes.data.name) || n.title.includes(sprintRes.data.name)),
  );
  assert(!!sprintNotif, `Found sprint notification for user-2 (team member): "${sprintNotif?.title}" - "${sprintNotif?.message}"`);

  // 7. Test System Alert Notification Trigger
  console.log('\n7. Testing System Alert Trigger...');
  const alertRes = await request('/notifications/system-alert', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      title: 'Scheduled Maintenance Notice',
      message: 'Infrastructure upgrade scheduled for 02:00 UTC.',
      targetRole: 'Support_Agent',
    },
  });
  if (alertRes.status !== 200 && alertRes.status !== 201) {
    console.log('alertRes status:', alertRes.status, 'data:', alertRes.data);
  }
  assert(alertRes.status === 200 || alertRes.status === 201, 'Dispatched system alert to Support_Agent role');

  const user2Notifs4 = await request('/notifications', { headers: user2Headers });
  const systemNotif = user2Notifs4.data.find((n: any) => n.type === 'system');
  assert(!!systemNotif, `Found system alert notification for user-2: "${systemNotif?.title}"`);

  // 8. Test GET /api/notifications/unread-count
  console.log('\n8. Testing GET /api/notifications/unread-count...');
  const countRes = await request('/notifications/unread-count', { headers: user2Headers });
  assert(countRes.status === 200, 'GET /api/notifications/unread-count returned HTTP 200');
  const unreadVal = countRes.data.unreadCount ?? countRes.data.count;
  assert(typeof unreadVal === 'number' && unreadVal > 0, `Unread count is ${unreadVal}`);

  // 9. Test PATCH /api/notifications/:id/read (Real Database ID)
  console.log('\n9. Testing PATCH /api/notifications/:id/read...');
  const notifToRead = user2Notifs4.data.find((n: any) => !n.read);
  assert(!!notifToRead, 'Found unread notification to test markAsRead');
  const markReadRes = await request(`/notifications/${notifToRead.id}/read`, {
    method: 'PATCH',
    headers: user2Headers,
  });
  assert(markReadRes.status === 200, `PATCH /api/notifications/${notifToRead.id}/read returned HTTP 200`);
  assert(markReadRes.data.read === true, 'Notification status is now read=true');

  // 10. Test POST /api/notifications/mark-all-read
  console.log('\n10. Testing POST /api/notifications/mark-all-read...');
  const markAllRes = await request('/notifications/mark-all-read', {
    method: 'POST',
    headers: user2Headers,
  });
  assert(markAllRes.status === 200, 'POST /api/notifications/mark-all-read returned HTTP 200');

  const finalCountRes = await request('/notifications/unread-count', { headers: user2Headers });
  const finalVal = finalCountRes.data.unreadCount ?? finalCountRes.data.count;
  assert(finalVal === 0, 'Unread count is now 0 after mark-all-read');

  // 11. Test 404 Handling
  console.log('\n11. Testing 404 Response on Non-Existent Notification...');
  const nonExistentRes = await request('/notifications/non-existent-cuid/read', {
    method: 'PATCH',
    headers: user2Headers,
  });
  assert(nonExistentRes.status === 404, 'Correctly returned 404 for non-existent notification ID');

  console.log('\n================================================================');
  console.log(`ALL ${passedCount}/${totalTests} END-TO-END TESTS PASSED SUCCESSFULLY!`);
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('\nE2E TEST RUN FAILED:', err);
  process.exit(1);
});
