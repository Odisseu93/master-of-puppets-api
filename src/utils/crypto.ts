import crypto from 'crypto';

/**
 * Computes a SHA-256 hash of the given string.
 * Used for hashing API keys before storage.
 */
export function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}
