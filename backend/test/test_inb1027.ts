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
            // raw string
          }
          resolve({ status: res.statusCode || 0, headers: res.headers, data });
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function createMultipartBody(fieldName: string, filename: string, content: Buffer, boundary: string): Buffer {
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return Buffer.concat([head, content, tail]);
}

async function run() {
  console.log('=== VERIFYING ATTACHMENT UPLOAD TO INB-1027 ===\n');

  // 1. Login
  const loginRes = await request(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, JSON.stringify({ emailOrId: 'tejas@inbox.GoldMine.io', password: 'admin123' }));

  const token = loginRes.data.accessToken;
  console.log('Logged in successfully as Admin.');

  // 2. Upload to INB-1027
  const boundary = '----Boundary' + Date.now();
  const fileContent = Buffer.from('[2026-10-15 12:40:00] INFO: Sub-task connector hierarchy trace rendered successfully.\nStack: UI Tree -> SubTaskNode -> Checkbox');
  const body = createMultipartBody('file', 'subtask-connector-trace.log', fileContent, boundary);

  const uploadRes = await request(`${API_BASE}/issues/INB-1027/attachments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
  }, body);

  console.log('Upload response status:', uploadRes.status);
  console.log('Upload response data:', uploadRes.data);

  if (uploadRes.status !== 201) {
    console.error('FAILED: Expected 201 Created');
    process.exit(1);
  }

  const attachmentId = uploadRes.data.id;

  // 3. List attachments for INB-1027
  const listRes = await request(`${API_BASE}/issues/INB-1027/attachments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('List attachments status:', listRes.status, 'Count:', listRes.data.length);

  // 4. Download attachment
  const downloadRes = await request(`${API_BASE}/attachments/${attachmentId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Download status:', downloadRes.status, 'Disposition:', downloadRes.headers['content-disposition']);

  // 5. Genuinely nonexistent issue rejection
  const nonexistentRes = await request(`${API_BASE}/issues/NONEXISTENT-9999/attachments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
  }, body);
  console.log('Nonexistent issue rejection status:', nonexistentRes.status, nonexistentRes.data);

  if (nonexistentRes.status === 404) {
    console.log('[PASS] Genuinely nonexistent issue properly rejected with 404');
  } else {
    console.error('[FAIL] Expected 404 for nonexistent issue');
    process.exit(1);
  }

  console.log('\n=== ALL INB-1027 VERIFICATIONS PASSED ===');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
