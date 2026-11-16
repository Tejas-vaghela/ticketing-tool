import { resolveOriginalUrl } from './common/utils/routing.util';

describe('Serverless API Routing Normalizer', () => {
  it('should restore path from x-matched-path header on Vercel rewrite', () => {
    const mockReq: any = {
      url: '/api',
      headers: {
        'x-matched-path': '/api/auth/login',
      },
    };

    const resolved = resolveOriginalUrl(mockReq);
    expect(resolved).toBe('/api/auth/login');
  });

  it('should preserve query parameters during rewrite normalization', () => {
    const mockReq: any = {
      url: '/api?status=Open&limit=20',
      headers: {
        'x-matched-path': '/api/issues',
      },
    };

    const resolved = resolveOriginalUrl(mockReq);
    expect(resolved).toBe('/api/issues?status=Open&limit=20');
  });

  it('should restore path from x-forwarded-uri if x-matched-path is not present', () => {
    const mockReq: any = {
      url: '/api',
      headers: {
        'x-forwarded-uri': '/api/users/c123456789',
      },
    };

    const resolved = resolveOriginalUrl(mockReq);
    expect(resolved).toBe('/api/users/c123456789');
  });

  it('should fall back to originalUrl if available', () => {
    const mockReq: any = {
      url: '/api',
      originalUrl: '/api/projects/INB',
      headers: {},
    };

    const resolved = resolveOriginalUrl(mockReq);
    expect(resolved).toBe('/api/projects/INB');
  });

  it('should leave normal req.url unchanged if no rewrite headers exist', () => {
    const mockReq: any = {
      url: '/api/health',
      headers: {},
    };

    const resolved = resolveOriginalUrl(mockReq);
    expect(resolved).toBe('/api/health');
  });
});
