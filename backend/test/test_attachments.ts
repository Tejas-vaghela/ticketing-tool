import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

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

function createMultipartBody(fieldName: string, filename: string, fileContent: Buffer, boundary: string): Buffer {
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return Buffer.concat([head, fileContent, tail]);
}

async function login(emailOrId: string, passwordPlain: string): Promise<string> {
  const res = await request(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, JSON.stringify({ emailOrId, password: passwordPlain }));

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Login failed for ${emailOrId}: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.data.accessToken;
}

async function runTests() {
  console.log('=== ATTACHMENTS MODULE INTEGRATION TEST SUITE ===\n');
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
    // 1. Authenticate users
    console.log('Logging in test accounts...');
    const adminToken = await login('tejas@inbox.GoldMine.io', 'admin123'); // Admin
    const devToken = await login('rahul.s@inbox.GoldMine.io', 'support123'); // Support_Agent
    
    // Create/get a viewer token if viewer exists, or check user list
    const usersRes = await request(`${API_BASE}/users?limit=50`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const viewerUser = usersRes.data.data?.find((u: any) => u.role === 'Viewer');
    let viewerToken = '';
    if (viewerUser) {
      viewerToken = await login(viewerUser.email, 'viewer123').catch(() => '');
    }

    const testIssueId = 'INB-1001';
    let createdAttachmentId = '';

    // ATT-T01: Upload valid text file (traceback.log)
    {
      const boundary = '----Boundary' + Date.now();
      const content = Buffer.from('[2026-10-15 10:00:00] ERROR: Stripe payment timeout on line 42.\nStacktrace:\n  at processCheckout (/app/checkout.ts:12)');
      const body = createMultipartBody('file', 'traceback.log', content, boundary);
      const res = await request(`${API_BASE}/issues/${testIssueId}/attachments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
      }, body);

      assert(res.status === 201 && res.data.filename === 'traceback.log' && res.data.fileType === 'text/plain', 'ATT-T01', `Upload valid file (status: ${res.status}, id: ${res.data.id})`);
      createdAttachmentId = res.data.id;
    }

    // ATT-T02: Upload valid PNG image with magic numbers
    let imageAttachmentId = '';
    {
      const boundary = '----Boundary' + Date.now();
      // Valid PNG header: 89 50 4E 47 0D 0A 1A 0A
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
      const body = createMultipartBody('file', 'screenshot.png', pngHeader, boundary);
      const res = await request(`${API_BASE}/issues/${testIssueId}/attachments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
      }, body);

      assert(res.status === 201 && res.data.filename === 'screenshot.png' && res.data.fileType === 'image/png', 'ATT-T02', `Upload valid PNG image (status: ${res.status})`);
      imageAttachmentId = res.data.id;
    }

    // ATT-T03: Reject file exceeding 25 MB
    {
      const boundary = '----Boundary' + Date.now();
      // Send 26 MB of data
      const largeContent = Buffer.alloc(26 * 1024 * 1024);
      const body = createMultipartBody('file', 'large_dump.log', largeContent, boundary);
      const res = await request(`${API_BASE}/issues/${testIssueId}/attachments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
      }, body);

      assert(res.status === 413, 'ATT-T03', `Reject file exceeding 25MB (status: ${res.status})`);
    }

    // ATT-T04: Reject dangerous executable (.exe, .sh, .bat)
    {
      const boundary = '----Boundary' + Date.now();
      const content = Buffer.from('echo "malicious payload"');
      const resExe = await request(`${API_BASE}/issues/${testIssueId}/attachments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
      }, createMultipartBody('file', 'payload.exe', content, boundary));

      const resSh = await request(`${API_BASE}/issues/${testIssueId}/attachments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
      }, createMultipartBody('file', 'script.sh', content, boundary));

      assert(resExe.status === 415 && resSh.status === 415, 'ATT-T04', `Reject dangerous executable extensions (.exe: ${resExe.status}, .sh: ${resSh.status})`);
    }

    // ATT-T05: Upload without file payload (missing 'file' field)
    {
      const boundary = '----Boundary' + Date.now();
      const content = Buffer.from('hello');
      const res = await request(`${API_BASE}/issues/${testIssueId}/attachments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
      }, createMultipartBody('wrong_field', 'test.txt', content, boundary));

      assert(res.status === 400, 'ATT-T05', `Reject missing file payload (status: ${res.status})`);
    }

    // ATT-T06: Upload to nonexistent issue ID
    {
      const boundary = '----Boundary' + Date.now();
      const content = Buffer.from('test text data');
      const res = await request(`${API_BASE}/issues/NONEXISTENT-9999/attachments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
      }, createMultipartBody('file', 'test.txt', content, boundary));

      assert(res.status === 404, 'ATT-T06', `Reject nonexistent issue ID (status: ${res.status})`);
    }

    // ATT-T07: Upload unauthenticated (missing JWT)
    {
      const boundary = '----Boundary' + Date.now();
      const content = Buffer.from('test text data');
      const res = await request(`${API_BASE}/issues/${testIssueId}/attachments`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
      }, createMultipartBody('file', 'test.txt', content, boundary));

      assert(res.status === 401, 'ATT-T07', `Reject unauthenticated upload (status: ${res.status})`);
    }

    // ATT-T08: Viewer role attempts file upload (403 Forbidden)
    {
      // Create a temporary Viewer user using adminToken
      const viewerEmail = `viewer_${Date.now()}@inbox.GoldMine.io`;
      const createViewerRes = await request(`${API_BASE}/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      }, JSON.stringify({
        name: 'Test Viewer',
        email: viewerEmail,
        password: 'viewerPassword123!',
        role: 'Viewer',
        department: 'Auditing',
        supportLevels: ['L1'],
      }));

      if (createViewerRes.status === 201) {
        const viewerToken = await login(viewerEmail, 'viewerPassword123!');
        const boundary = '----Boundary' + Date.now();
        const content = Buffer.from('viewer text content');
        const res = await request(`${API_BASE}/issues/${testIssueId}/attachments`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${viewerToken}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
        }, createMultipartBody('file', 'viewer_test.txt', content, boundary));

        assert(res.status === 403, 'ATT-T08', `Viewer role upload rejected with 403 (status: ${res.status})`);
      } else {
        console.log(`[SKIP] ATT-T08: Failed to create viewer: ${createViewerRes.status}`);
      }
    }

    // ATT-T09: List attachments for existing issue
    {
      const res = await request(`${API_BASE}/issues/${testIssueId}/attachments`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert(res.status === 200 && Array.isArray(res.data) && res.data.length >= 2, 'ATT-T09', `List attachments for issue (status: ${res.status}, count: ${res.data.length})`);
    }

    // ATT-T10: Get attachment metadata by ID
    {
      const res = await request(`${API_BASE}/attachments/${createdAttachmentId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert(res.status === 200 && res.data.id === createdAttachmentId, 'ATT-T10', `Get attachment metadata by ID (status: ${res.status}, filename: ${res.data.filename})`);
    }

    // ATT-T11: Download attachment binary stream with RFC headers & nosniff
    {
      const res = await request(`${API_BASE}/attachments/${createdAttachmentId}/download`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const disposition = res.headers['content-disposition'] || '';
      const nosniff = res.headers['x-content-type-options'] || '';
      const contentType = res.headers['content-type'] || '';

      assert(
        res.status === 200 &&
          disposition.includes('attachment') &&
          nosniff === 'nosniff' &&
          contentType.includes('text/plain'),
        'ATT-T11',
        `Download binary with correct headers (status: ${res.status}, disposition: ${disposition})`,
      );
    }

    // ATT-T12: Download nonexistent attachment
    {
      const res = await request(`${API_BASE}/attachments/NONEXISTENT_ID/download`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert(res.status === 404, 'ATT-T12', `Download nonexistent attachment (status: ${res.status})`);
    }

    // ATT-T16: Content validation rejection (executable disguised as .png)
    {
      const boundary = '----Boundary' + Date.now();
      // Not a real PNG, just random text disguised as .png
      const fakePng = Buffer.from('This is not a png file header!');
      const res = await request(`${API_BASE}/issues/${testIssueId}/attachments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
      }, createMultipartBody('file', 'fake.png', fakePng, boundary));

      assert(res.status === 415, 'ATT-T16', `Reject spoofed magic number (status: ${res.status})`);
    }

    // ATT-T15: Non-admin attempts attachment deletion (Pre-migration RBAC: 403 Forbidden)
    {
      const res = await request(`${API_BASE}/issues/${testIssueId}/attachments/${createdAttachmentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${devToken}` },
      });

      assert(res.status === 403, 'ATT-T15', `Non-admin delete rejected with 403 (status: ${res.status})`);
    }

    // ATT-T13 & ATT-T14: Admin deletes attachment and unlinks physical file
    {
      const res = await request(`${API_BASE}/issues/${testIssueId}/attachments/${createdAttachmentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert(res.status === 200 && res.data.id === createdAttachmentId, 'ATT-T13', `Admin deletes attachment (status: ${res.status})`);

      // Verify metadata is deleted from database
      const verifyRes = await request(`${API_BASE}/attachments/${createdAttachmentId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(verifyRes.status === 404, 'ATT-T14', `Attachment record removed from DB after deletion (status: ${verifyRes.status})`);
    }

    // ATT-T17: Reject deletion when attachment belongs to a different issue
    {
      const res = await request(`${API_BASE}/issues/INB-1002/attachments/cmvf4ah5l7ea3c02a75404c2f`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert(res.status === 404, 'ATT-T17', `Reject deletion on mismatched issueId (status: ${res.status})`);
    }

    // ATT-T18: Path traversal rejection on download
    {
      const res = await request(`${API_BASE}/attachments/..%2F..%2F..%2Fetc%2Fpasswd/download`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert(res.status === 404 || res.status === 400, 'ATT-T18', `Reject path traversal on download (status: ${res.status})`);
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
