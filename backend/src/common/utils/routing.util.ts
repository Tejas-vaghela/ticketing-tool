import type { Request } from 'express';

/**
 * Resolves the true client-requested path under Vercel edge rewrites.
 * Vercel rewrites often set req.url to '/api', preserving the actual path in headers.
 */
export function resolveOriginalUrl(req: Request): string {
  const matchedPath =
    (req.headers['x-matched-path'] as string) ||
    (req.headers['x-forwarded-uri'] as string);

  if (matchedPath && matchedPath.startsWith('/api')) {
    const queryIndex = req.url ? req.url.indexOf('?') : -1;
    const queryString = queryIndex !== -1 ? req.url.substring(queryIndex) : '';
    return matchedPath.includes('?') ? matchedPath : `${matchedPath}${queryString}`;
  }

  if ((req as any).originalUrl && (req as any).originalUrl.startsWith('/api')) {
    return (req as any).originalUrl;
  }

  return req.url || '/api';
}
