import v from 'vkrun';
import { env } from '../utils/env';

/**
 * Parses the CORS_ORIGIN environment variable and returns a middleware
 * and the configured vkrun cors instance.
 */
export function setupCors() {
  const corsOriginEnv = env.CORS_ORIGIN;
  const origins = corsOriginEnv
    ? corsOriginEnv.trim() === '*'
      ? '*'
      : corsOriginEnv.includes(',')
        ? corsOriginEnv.split(',').map(o => o.trim())
        : [corsOriginEnv.trim()]
    : '*';

  let preCorsMiddleware: ((req: v.Request, res: v.Response, next: v.NextFunction) => void) | null = null;

  if (origins !== '*' && Array.isArray(origins)) {
    const wildcards = origins.filter(o => o.includes('*') && o !== '*');
    const staticOriginsCount = origins.length;
    const MAX_DYNAMIC_ORIGINS = 1000; // Prevent memory leak

    if (wildcards.length > 0) {
      // Pre-compile regexes for performance
      const regexes = wildcards.map(pattern => {
        const regexStr = '^' + pattern
          .split('*')
          .map(part => part.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&'))
          .join('[^/]+') + '$';
        return new RegExp(regexStr, 'i');
      });

      preCorsMiddleware = (req: v.Request, res: v.Response, next: v.NextFunction) => {
        const requestOrigin = req.headers.origin;
        if (requestOrigin && !origins.includes(requestOrigin)) {
          for (const regex of regexes) {
            if (regex.test(requestOrigin)) {
              // Add to allowed origins for vkrun cors to see it
              origins.push(requestOrigin);
              
              // Cap the size to prevent memory leaks (keep static origins intact)
              if (origins.length > staticOriginsCount + MAX_DYNAMIC_ORIGINS) {
                origins.splice(staticOriginsCount, 1);
              }
              break;
            }
          }
        }
        next();
      };
    }
  }

  const corsMiddleware = v.cors({
    origin: origins,
  });

  return {
    preCorsMiddleware,
    corsMiddleware
  };
}
