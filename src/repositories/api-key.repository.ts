import { Database } from 'sqlite';
import { ApiKey } from '../types';

export interface IApiKeyRepository {
  findActiveByHash(hash: string): Promise<ApiKey | null>;
}

export class ApiKeyRepository implements IApiKeyRepository {
  constructor(private db: Database) {}

  async findActiveByHash(hash: string): Promise<ApiKey | null> {
    const key = await this.db.get<ApiKey>(
      `SELECT * FROM api_keys 
       WHERE key_hash = ? 
         AND revoked_at IS NULL 
         AND (expires_at IS NULL OR expires_at > ?)`,
      [hash, new Date().toISOString()]
    );
    return key || null;
  }
}
