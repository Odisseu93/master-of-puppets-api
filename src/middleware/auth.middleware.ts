import v from 'vkrun';
import { getDatabase } from '../database';
import { logger } from '../utils/logger';
import { hashKey } from '../utils/crypto';
import { sendJson } from '../utils/response';
import { ApiKey } from '../types';

export interface AuthenticatedRequest extends v.Request {
  apiKeyInfo?: {
    id: number;
    name: string;
    prefix: string;
  };
}

/**
 * Middleware to authenticate requests via API Key.
 */
export async function authMiddleware(
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
    const db = await getDatabase();
    const keyHash = hashKey(apiKey);

    const activeKey = await db.get<ApiKey>(
      `SELECT * FROM api_keys 
       WHERE key_hash = ? 
         AND revoked_at IS NULL 
         AND (expires_at IS NULL OR expires_at > ?)`,
      [keyHash, new Date().toISOString()]
    );

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
}
