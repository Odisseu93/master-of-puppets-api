import crypto from 'crypto';
import v from 'vkrun';
import { Database } from 'sqlite';
import { getDatabase, closeDatabase } from '../database';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';

// Use an in-memory SQLite database for testing
process.env.DATABASE_PATH = ':memory:';

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

describe('Auth Middleware', () => {
  let db: Database;
  const mockPrefix = 'sk_live_test1234';
  const mockSecret = 'supersecretkeyfortesting';
  const mockFullKey = `${mockPrefix}.${mockSecret}`;
  const mockKeyHash = hashKey(mockFullKey);

  beforeAll(async () => {
    db = await getDatabase();
    
    // Clear table to avoid unique constraint errors during tests
    await db.run('DELETE FROM api_keys');

    // Seed test keys
    // 1. Valid key
    await db.run(
      `INSERT INTO api_keys (name, key_hash, key_prefix, expires_at)
       VALUES (?, ?, ?, NULL)`,
      ['Valid Test Key', mockKeyHash, mockPrefix]
    );

    // 2. Expired key
    const expiredHash = hashKey('sk_live_expired.secret');
    const expiredDate = new Date();
    expiredDate.setHours(expiredDate.getHours() - 1); // 1 hour in the past
    await db.run(
      `INSERT INTO api_keys (name, key_hash, key_prefix, expires_at)
       VALUES (?, ?, ?, ?)`,
      ['Expired Test Key', expiredHash, 'sk_live_expired', expiredDate.toISOString()]
    );

    // 3. Revoked key
    const revokedHash = hashKey('sk_live_revoked.secret');
    await db.run(
      `INSERT INTO api_keys (name, key_hash, key_prefix, expires_at, revoked_at)
       VALUES (?, ?, ?, NULL, ?)`,
      ['Revoked Test Key', revokedHash, 'sk_live_revoked', new Date().toISOString()]
    );
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('should return 401 if x-api-key header is missing', async () => {
    const req = {
      headers: {},
    } as unknown as v.Request;

    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      setHeader: jest.fn(),
    } as unknown as v.Response;

    const next = jest.fn() as unknown as v.NextFunction;

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith(
      expect.stringContaining('API Key is missing')
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if API key is invalid', async () => {
    const req = {
      headers: {
        'x-api-key': 'sk_live_invalid.secret',
      },
    } as unknown as v.Request;

    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      setHeader: jest.fn(),
    } as unknown as v.Response;

    const next = jest.fn() as unknown as v.NextFunction;

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith(
      expect.stringContaining('Invalid or expired API Key')
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if API key is expired', async () => {
    const req = {
      headers: {
        'x-api-key': 'sk_live_expired.secret',
      },
    } as unknown as v.Request;

    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      setHeader: jest.fn(),
    } as unknown as v.Response;

    const next = jest.fn() as unknown as v.NextFunction;

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith(
      expect.stringContaining('Invalid or expired API Key')
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if API key is revoked', async () => {
    const req = {
      headers: {
        'x-api-key': 'sk_live_revoked.secret',
      },
    } as unknown as v.Request;

    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      setHeader: jest.fn(),
    } as unknown as v.Response;

    const next = jest.fn() as unknown as v.NextFunction;

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith(
      expect.stringContaining('Invalid or expired API Key')
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next and attach apiKeyInfo if key is valid', async () => {
    const req = {
      headers: {
        'x-api-key': mockFullKey,
      },
    } as unknown as AuthenticatedRequest;

    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      setHeader: jest.fn(),
    } as unknown as v.Response;

    const next = jest.fn() as unknown as v.NextFunction;

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.apiKeyInfo).toBeDefined();
    expect(req.apiKeyInfo?.name).toBe('Valid Test Key');
    expect(req.apiKeyInfo?.prefix).toBe(mockPrefix);
  });
});
