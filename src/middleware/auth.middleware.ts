import v from 'vkrun';
import crypto from 'crypto';
import { getDatabase } from '../database';

export interface AuthenticatedRequest extends v.Request {
  apiKeyInfo?: {
    id: number;
    name: string;
    prefix: string;
  };
}

/**
 * Computes SHA-256 hash of a string.
 */
function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
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
    res.setHeader('Content-Type', 'application/json');
    res.status(401).send(JSON.stringify({ error: 'Unauthorized: API Key is missing' }));
    return;
  }

  try {
    const db = await getDatabase();
    const keyHash = hashKey(apiKey);

    const activeKey = await db.get(
      `SELECT * FROM api_keys 
       WHERE key_hash = ? 
         AND revoked_at IS NULL 
         AND (expires_at IS NULL OR expires_at > ?)`,
      [keyHash, new Date().toISOString()]
    );

    if (!activeKey) {
      res.setHeader('Content-Type', 'application/json');
      res.status(401).send(JSON.stringify({ error: 'Unauthorized: Invalid or expired API Key' }));
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
    console.error('Authentication middleware error:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).send(JSON.stringify({ error: 'Internal Server Error' }));
  }
}
