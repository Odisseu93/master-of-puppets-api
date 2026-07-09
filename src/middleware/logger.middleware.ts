import v from 'vkrun';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from './auth.middleware';

/**
 * Middleware to log HTTP request metadata and execution duration.
 */
export function requestLoggerMiddleware(
  req: v.Request,
  res: v.Response,
  next: v.NextFunction
): void {
  const start = process.hrtime();

  const reqWithSocket = req as unknown as { socket?: { remoteAddress?: string } };
  const ip = (req.headers['x-forwarded-for'] as string) || (reqWithSocket.socket?.remoteAddress || 'unknown');

  // Sanitize headers to prevent leaking sensitive information
  const safeHeaders = { ...req.headers };
  if (safeHeaders['x-api-key']) safeHeaders['x-api-key'] = '***';
  if (safeHeaders['authorization']) safeHeaders['authorization'] = '***';

  // Log incoming request
  logger.info({
    method: req.method,
    url: req.url,
    headers: safeHeaders,
    ip,
    userAgent: req.headers['user-agent'],
  }, `Request started: ${req.method} ${req.url}`);

  // Log request completion details
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
    const apiKeyPrefix = (req as AuthenticatedRequest).apiKeyInfo?.prefix || 'public';

    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      durationMs,
      apiKeyPrefix,
    }, `Request finished: ${req.method} ${req.url} -> ${res.statusCode} (${durationMs}ms)`);
  });

  next();
}

