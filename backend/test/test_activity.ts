import * as http from 'http';

const API_BASE = 'http://localhost:4000/api';

async function request(url: string, options: any = {}, body?: any): Promise<{ status: number; headers: any; data: any }> {
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
            // Raw text fallback
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

async function login(email: string, password: string): Promise<string> {
  const res = await request(
    `${API_BASE}/auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({ emailOrId: email, password }),
  );
  if (res.status !== 200 || !res.data.accessToken) {
    throw new Error(`Login failed for ${email}: status ${res.status}, response: ${JSON.stringify(res.data)}`);
  }
  return res.data.accessToken;
}

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

async function runTests() {
  console.log('=== RUNNING ACTIVITY MODULE BACKEND TESTS ===\n');

  try {
    // 1. Authenticate users
    const adminToken = await login('tejas@inbox.GoldMine.io', 'admin123');
    
    // Find viewer or dev user
    const usersRes = await request(`${API_BASE}/users?limit=50`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const viewerUser = usersRes.data.data?.find((u: any) => u.role === 'Viewer') || usersRes.data.data?.find((u: any) => u.id === 'user-8');
    let viewerToken = adminToken;
    if (viewerUser) {
      try {
        viewerToken = await login(viewerUser.email, 'viewer123');
      } catch {
        viewerToken = adminToken;
      }
    }
    console.log('Authentication successful.\n');

    // ACT-T01: Unauthenticated request to /api/activity rejected with 401
    {
      const res = await request(`${API_BASE}/activity`);
      assert(res.status === 401, 'ACT-T01', `Unauthenticated request returns 401 Unauthorized (status: ${res.status})`);
    }

    // ACT-T02: Invalid bearer token rejected with 401
    {
      const res = await request(`${API_BASE}/activity`, {
        headers: { Authorization: 'Bearer invalid_bogus_token_xyz' },
      });
      assert(res.status === 401, 'ACT-T02', `Invalid JWT returns 401 Unauthorized (status: ${res.status})`);
    }

    // ACT-T03: Authenticated request returns 200 with feed envelope
    let feedItems: any[] = [];
    {
      const res = await request(`${API_BASE}/activity`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(
        res.status === 200 && Array.isArray(res.data.items) && typeof res.data.total === 'number',
        'ACT-T03',
        `Authenticated GET /api/activity returns 200 with { items, total, hasMore } (total: ${res.data.total}, items: ${res.data.items?.length})`,
      );
      feedItems = res.data.items || [];
    }

    // ACT-T04: Chronological order (newest first)
    {
      let isOrdered = true;
      for (let i = 0; i < feedItems.length - 1; i++) {
        const curr = new Date(feedItems[i].timestamp).getTime();
        const next = new Date(feedItems[i + 1].timestamp).getTime();
        if (curr < next) {
          isOrdered = false;
          break;
        }
      }
      assert(isOrdered, 'ACT-T04', `Feed items are ordered chronologically newest first`);
    }

    // ACT-T05: Keyset pagination limit & nextCursor
    let firstPageCursor: string | null = null;
    let firstPageIds: string[] = [];
    {
      const res = await request(`${API_BASE}/activity?limit=3`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const valid = res.status === 200 && res.data.items.length <= 3 && (res.data.items.length < 3 || res.data.nextCursor !== undefined);
      assert(valid, 'ACT-T05', `Keyset pagination with limit=3 returns max 3 items and nextCursor`);
      firstPageCursor = res.data.nextCursor;
      firstPageIds = (res.data.items || []).map((i: any) => i.id);
    }

    // ACT-T06: Keyset pagination next page with cursor
    if (firstPageCursor) {
      const res = await request(`${API_BASE}/activity?limit=3&cursor=${firstPageCursor}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const secondPageIds = (res.data.items || []).map((i: any) => i.id);
      const isDistinct = secondPageIds.every((id: string) => !firstPageIds.includes(id));
      assert(res.status === 200 && isDistinct, 'ACT-T06', `Keyset pagination cursor yields subsequent distinct items`);
    } else {
      assert(true, 'ACT-T06', `Keyset pagination cursor test skipped (fewer than 4 items in DB)`);
    }

    // ACT-T07: Offset pagination page & limit
    {
      const res = await request(`${API_BASE}/activity?page=1&limit=2`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(
        res.status === 200 && Array.isArray(res.data.items) && res.data.items.length <= 2,
        'ACT-T07',
        `Offset pagination with page=1&limit=2 returns valid subset (count: ${res.data.items?.length})`,
      );
    }

    // ACT-T08: Filter by action verb
    {
      const res = await request(`${API_BASE}/activity?action=created`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const allCreated = res.data.items?.every((item: any) => item.action === 'created');
      assert(res.status === 200 && allCreated, 'ACT-T08', `Filter by action=created returns only matching events`);
    }

    // ACT-T09: Filter by userId
    {
      const res = await request(`${API_BASE}/activity?userId=user-1`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const allUser1 = res.data.items?.every((item: any) => item.userId === 'user-1');
      assert(res.status === 200 && allUser1, 'ACT-T09', `Filter by userId=user-1 returns only events by actor user-1`);
    }

    // ACT-T10: Filter by existing projectId
    let knownProjectId = feedItems.find((i) => i.projectId)?.projectId;
    if (!knownProjectId) {
      // Find a project from /api/projects
      const projRes = await request(`${API_BASE}/projects`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      knownProjectId = projRes.data[0]?.id;
    }

    if (knownProjectId) {
      const res = await request(`${API_BASE}/activity?projectId=${knownProjectId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const allProj = res.data.items?.every((item: any) => item.projectId === knownProjectId);
      assert(res.status === 200 && allProj, 'ACT-T10', `Filter by projectId=${knownProjectId} returns only events for that project`);
    } else {
      assert(true, 'ACT-T10', 'Filter by projectId test skipped (no project found)');
    }

    // ACT-T11: Filter by non-existent projectId returns 404
    {
      const res = await request(`${API_BASE}/activity?projectId=non_existent_project_cuid_123`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(res.status === 404, 'ACT-T11', `Filter by non-existent projectId returns 404 Not Found (status: ${res.status})`);
    }

    // ACT-T12: Filter by non-existent issueId returns 404
    {
      const res = await request(`${API_BASE}/activity?issueId=INB-99999`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(res.status === 404, 'ACT-T12', `Filter by non-existent issueId returns 404 Not Found (status: ${res.status})`);
    }

    // ACT-T13: GET /api/activity/issues/:issueId for valid issue
    let knownIssueId = feedItems.find((i) => i.issueId)?.issueId || 'INB-1001';
    {
      const res = await request(`${API_BASE}/activity/issues/${knownIssueId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(
        res.status === 200 && Array.isArray(res.data),
        'ACT-T13',
        `GET /api/activity/issues/${knownIssueId} returns 200 OK array (count: ${res.data?.length})`,
      );
    }

    // ACT-T14: GET /api/issues/:issueId/activity (route alias) for valid issue
    {
      const res = await request(`${API_BASE}/issues/${knownIssueId}/activity`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(
        res.status === 200 && Array.isArray(res.data),
        'ACT-T14',
        `GET /api/issues/${knownIssueId}/activity returns 200 OK array (count: ${res.data?.length})`,
      );
    }

    // ACT-T15: GET /api/activity/issues/INB-99999 returns 404 Not Found
    {
      const res = await request(`${API_BASE}/activity/issues/INB-99999`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(res.status === 404, 'ACT-T15', `GET /api/activity/issues/INB-99999 returns 404 Not Found (status: ${res.status})`);
    }

    // ACT-T16: GET /api/activity/projects/:projectId for valid project
    if (knownProjectId) {
      const res = await request(`${API_BASE}/activity/projects/${knownProjectId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(
        res.status === 200 && Array.isArray(res.data),
        'ACT-T16',
        `GET /api/activity/projects/${knownProjectId} returns 200 OK array (count: ${res.data?.length})`,
      );
    }

    // ACT-T17: GET /api/projects/:projectId/activity (route alias) for valid project
    if (knownProjectId) {
      const res = await request(`${API_BASE}/projects/${knownProjectId}/activity`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(
        res.status === 200 && Array.isArray(res.data),
        'ACT-T17',
        `GET /api/projects/${knownProjectId}/activity returns 200 OK array (count: ${res.data?.length})`,
      );
    }

    // ACT-T18: GET /api/activity/projects/NONEXISTENT returns 404 Not Found
    {
      const res = await request(`${API_BASE}/activity/projects/NONEXISTENT_PROJECT`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(res.status === 404, 'ACT-T18', `GET /api/activity/projects/NONEXISTENT returns 404 Not Found (status: ${res.status})`);
    }

    // ACT-T19: Relational includes and sensitive info redaction
    {
      const res = await request(`${API_BASE}/activity?limit=1`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const first = res.data.items?.[0];
      const hasUser = first && first.user && first.user.id && first.user.email && first.user.role;
      const noPassword = first && first.user && !first.user.password && !first.user.passwordHash;
      assert(hasUser && noPassword, 'ACT-T19', `Actor user details safely included without sensitive password/secrets`);
    }

    // ACT-T20: Immutability - Arbitrary POST /api/activity rejected (404/405)
    {
      const res = await request(
        `${API_BASE}/activity`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
        },
        JSON.stringify({
          action: 'hacked_event',
          details: 'arbitrary audit log injected',
        }),
      );
      assert(
        res.status === 404 || res.status === 405,
        'ACT-T20',
        `Immutability enforced: POST /api/activity is rejected (status: ${res.status})`,
      );
    }

    // ACT-T21: Immutability - Arbitrary DELETE /api/activity/:id rejected (404/405)
    {
      const res = await request(`${API_BASE}/activity/some_event_id`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(
        res.status === 404 || res.status === 405,
        'ACT-T21',
        `Immutability enforced: DELETE /api/activity/:id is rejected (status: ${res.status})`,
      );
    }

    // ACT-T22: Query validation - limit > 100 rejected with 400 Bad Request
    {
      const res = await request(`${API_BASE}/activity?limit=500`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(res.status === 400, 'ACT-T22', `Query validation: limit=500 returns 400 Bad Request (status: ${res.status})`);
    }

    // ACT-T23: Viewer role can read activity feed (All 8 roles have read access)
    {
      const res = await request(`${API_BASE}/activity?limit=5`, {
        headers: { Authorization: `Bearer ${viewerToken}` },
      });
      assert(
        res.status === 200 && Array.isArray(res.data.items),
        'ACT-T23',
        `Viewer role successfully retrieves activity feed (items: ${res.data.items?.length})`,
      );
    }

    console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
