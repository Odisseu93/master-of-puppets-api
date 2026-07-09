import v from 'vkrun';
import { IApiKeyRepository } from '../repositories/api-key.repository';
import { logger } from '../utils/logger';
import { hashKey } from '../utils/crypto';
import { sendJson } from '../utils/response';

export interface AuthenticatedRequest extends v.Request {
  apiKeyInfo?: {
    id: number;
    name: string;
    prefix: string;
  };
}

/**
 * Creates a middleware to authenticate requests via API Key using the injected repository.
 */
export function createAuthMiddleware(apiKeyRepo: IApiKeyRepository) {
  return async function authMiddleware(
    req: v.Request,
    res: v.Response,
    next: v.NextFunction
  ): Promise<void> {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || typeof apiKey !== 'string') {
      sendJson(res, 401, { error: 'Unauthorized: API Key is missing' });
      return;
    }

    try {
      const keyHash = hashKey(apiKey);
      const activeKey = await apiKeyRepo.findActiveByHash(keyHash);

      if (!activeKey) {
        sendJson(res, 401, { error: 'Unauthorized: Invalid or expired API Key' });
        return;
      }

      // Attach key metadata to request context for logging/tracking
      (req as AuthenticatedRequest).apiKeyInfo = {
        id: activeKey.id,
        name: activeKey.name,
        prefix: activeKey.key_prefix,
      };

      next();
    } catch (error) {
      logger.error({ err: error }, 'Authentication middleware error');
      sendJson(res, 500, { error: 'Internal Server Error' });
    }
  };
}
