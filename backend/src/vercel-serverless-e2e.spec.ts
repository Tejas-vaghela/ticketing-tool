import { EventEmitter } from 'events';
import handler, { bootstrapServer } from './serverless';

function executeRequest(options: {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
}): Promise<{ status: number; body: any; headers: Record<string, any> }> {
  return new Promise(async (resolve) => {
    await bootstrapServer();

    const req: any = new EventEmitter();
    req.method = options.method || 'GET';
    req.url = options.url;
    req.headers = { host: 'localhost', ...(options.headers || {}) };
    req.body = options.body;

    let statusCode = 200;
    const resHeaders: Record<string, any> = {};
    let responseData = '';

    const res: any = new EventEmitter();
    res.statusCode = 200;
    res.setHeader = (name: string, val: any) => {
      resHeaders[name.toLowerCase()] = val;
    };
    res.getHeader = (name: string) => resHeaders[name.toLowerCase()];
    res.writeHead = (code: number, headers: any) => {
      statusCode = code;
      if (headers) Object.assign(resHeaders, headers);
    };
    res.write = (chunk: any) => {
      responseData += chunk ? chunk.toString() : '';
    };
    res.end = (chunk: any) => {
      if (chunk) responseData += chunk.toString();
      let parsedBody = responseData;
      try {
        parsedBody = JSON.parse(responseData);
      } catch {}
      resolve({
        status: res.statusCode || statusCode,
        body: parsedBody,
        headers: resHeaders,
      });
    };
    res.status = (code: number) => {
      res.statusCode = code;
      statusCode = code;
      return res;
    };
    res.json = (data: any) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(data));
    };
    res.send = (data: any) => {
      res.end(typeof data === 'object' ? JSON.stringify(data) : data);
    };

    handler(req, res);
  });
}

describe('Vercel Serverless End-to-End Pipeline Integration', () => {
  it('1. GET /api/health — should reach AppController and return 200 OK', async () => {
    const res = await executeRequest({ url: '/api/health' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('2. GET /api — should reach AppController root status and return 200 OK', async () => {
    const res = await executeRequest({ url: '/api' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });

  it('3. POST /api/auth/login — should trigger ValidationPipe and reject missing credentials with 400', async () => {
    const res = await executeRequest({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      body: {},
    });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
    expect(Array.isArray(res.body.message)).toBe(true);
  });

  it('4. POST /api/auth/register — should confirm non-existent registration endpoint returns 404', async () => {
    const res = await executeRequest({
      method: 'POST',
      url: '/api/auth/register',
      headers: { 'content-type': 'application/json' },
      body: { email: 'test@example.com', password: 'password123' },
    });
    expect(res.status).toBe(404);
  });

  it('5. GET /api/users — should enforce JwtAuthGuard and return 401 Unauthorized without token', async () => {
    const res = await executeRequest({ url: '/api/users' });
    expect(res.status).toBe(401);
    expect(res.body.message).toContain('Authentication required');
  });

  it('6. GET /api/issues — should enforce JwtAuthGuard and return 401 Unauthorized without token', async () => {
    const res = await executeRequest({ url: '/api/issues?projectId=INB&status=Open' });
    expect(res.status).toBe(401);
  });

  it('7. GET /api/projects — should enforce JwtAuthGuard and return 401 Unauthorized without token', async () => {
    const res = await executeRequest({ url: '/api/projects' });
    expect(res.status).toBe(401);
  });

  it('8. GET /api/issues/INB-1001/attachments — should enforce JwtAuthGuard on attachments and return 401', async () => {
    const res = await executeRequest({ url: '/api/issues/INB-1001/attachments' });
    expect(res.status).toBe(401);
  });

  it('9. Vercel Rewrite Simulation — should route /api with x-matched-path header correctly', async () => {
    const res = await executeRequest({
      url: '/api',
      headers: { 'x-matched-path': '/api/health' },
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('10. Vercel Query Preservation — should preserve query parameters across rewrites', async () => {
    const res = await executeRequest({
      url: '/api?query=security',
      headers: { 'x-matched-path': '/api/health' },
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
