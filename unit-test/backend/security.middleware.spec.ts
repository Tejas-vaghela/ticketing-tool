import { SecurityMiddleware } from '../../backend/src/common/middleware/security.middleware';
import { Request, Response } from 'express';

describe('SecurityMiddleware', () => {
  let middleware: SecurityMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;
  let headers: Record<string, string>;

  beforeEach(() => {
    middleware = new SecurityMiddleware();
    SecurityMiddleware.resetCache();
    headers = {};
    nextFunction = jest.fn();

    mockRequest = {
      method: 'GET',
      headers: {},
      socket: { remoteAddress: '192.168.1.1' } as any,
    };

    mockResponse = {
      removeHeader: jest.fn(),
      setHeader: jest.fn((key: string, value: string) => {
        headers[key] = value;
        return mockResponse as Response;
      }),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it('should set Helmet security headers on every request', () => {
    middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.removeHeader).toHaveBeenCalledWith('X-Powered-By');
    expect(headers['X-DNS-Prefetch-Control']).toBe('off');
    expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(headers['Strict-Transport-Security']).toBe('max-age=15552000; includeSubDomains');
    expect(headers['X-Download-Options']).toBe('noopen');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Origin-Agent-Cluster']).toBe('?1');
    expect(headers['X-Permitted-Cross-Domain-Policies']).toBe('none');
    expect(headers['Referrer-Policy']).toBe('no-referrer');
    expect(headers['X-XSS-Protection']).toBe('0');
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should set rate limit headers and allow request below threshold', () => {
    middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(headers['X-RateLimit-Limit']).toBe('120');
    expect(headers['X-RateLimit-Remaining']).toBe('119');
    expect(Number(headers['X-RateLimit-Reset'])).toBeGreaterThan(0);
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should block requests exceeding rate limit with 429 Too Many Requests', () => {
    for (let i = 0; i < 120; i++) {
      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);
    }
    expect(nextFunction).toHaveBeenCalledTimes(120);

    // 121st request should be blocked
    middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);
    expect(mockResponse.status).toHaveBeenCalledWith(429);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 429,
        error: 'Too Many Requests',
      }),
    );
    // nextFunction should not have been called the 121st time
    expect(nextFunction).toHaveBeenCalledTimes(120);
  });

  it('should skip rate limiting on OPTIONS preflight requests', () => {
    mockRequest.method = 'OPTIONS';
    middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(headers['X-RateLimit-Limit']).toBeUndefined();
    expect(nextFunction).toHaveBeenCalledTimes(1);
  });
});
