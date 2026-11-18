import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  // In-memory IP rate limiter store
  private static readonly clients = new Map<string, RateLimitRecord>();
  private static readonly WINDOW_MS = 60 * 1000; // 1 minute window
  private static readonly MAX_REQUESTS = 120; // 120 requests per minute

  use(req: Request, res: Response, next: NextFunction): void {
    // 1. Helmet-Standard Security Headers
    try {
      if (typeof res.removeHeader === 'function') {
        res.removeHeader('X-Powered-By');
      }
    } catch {
      // Ignore if response mock or runtime does not support removeHeader
    }

    try {
      if (typeof res.setHeader === 'function') {
        res.setHeader('X-DNS-Prefetch-Control', 'off');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
        res.setHeader('X-Download-Options', 'noopen');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Origin-Agent-Cluster', '?1');
        res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('X-XSS-Protection', '0');
      }
    } catch {
      // Ignore if response mock does not support setHeader
    }

    // 2. Skip rate limiting for OPTIONS preflight requests
    if (req.method === 'OPTIONS') {
      return next();
    }

    // 3. Sliding-window IP Rate Limiting (safe across mock, express, and serverless requests)
    let clientIp = '127.0.0.1';
    try {
      if (req.headers && typeof req.headers['x-forwarded-for'] === 'string') {
        clientIp = req.headers['x-forwarded-for'].split(',')[0].trim();
      } else if (req.socket && req.socket.remoteAddress) {
        clientIp = req.socket.remoteAddress;
      } else if (req.ip) {
        clientIp = req.ip;
      }
    } catch {
      clientIp = '127.0.0.1';
    }

    const now = Date.now();
    let record = SecurityMiddleware.clients.get(clientIp);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + SecurityMiddleware.WINDOW_MS,
      };
      SecurityMiddleware.clients.set(clientIp, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, SecurityMiddleware.MAX_REQUESTS - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    try {
      if (typeof res.setHeader === 'function') {
        res.setHeader('X-RateLimit-Limit', SecurityMiddleware.MAX_REQUESTS.toString());
        res.setHeader('X-RateLimit-Remaining', remaining.toString());
        res.setHeader('X-RateLimit-Reset', resetSeconds.toString());
      }
    } catch {
      // Ignore if response mock does not support setHeader
    }

    if (record.count > SecurityMiddleware.MAX_REQUESTS) {
      res.status(429).json({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
      });
      return;
    }

    // Clean up expired entries if memory cache grows large
    if (SecurityMiddleware.clients.size > 1000) {
      for (const [ip, entry] of SecurityMiddleware.clients.entries()) {
        if (now > entry.resetTime) {
          SecurityMiddleware.clients.delete(ip);
        }
      }
    }

    next();
  }

  /**
   * Helper method for testing to reset the internal client cache
   */
  public static resetCache(): void {
    SecurityMiddleware.clients.clear();
  }
}
