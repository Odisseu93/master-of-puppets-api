import { ApiKeyRepository } from '../api-key.repository';
import { Database } from 'sqlite';
import { ApiKey } from '../../types';

describe('ApiKeyRepository', () => {
  let dbMock: jest.Mocked<Database>;
  let repo: ApiKeyRepository;

  beforeEach(() => {
    dbMock = {
      get: jest.fn(),
    } as unknown as jest.Mocked<Database>;

    repo = new ApiKeyRepository(dbMock);
  });

  describe('findActiveByHash', () => {
    it('should return the API key if found', async () => {
      const mockKey: ApiKey = {
        id: 1,
        name: 'test',
        key_hash: 'hash123',
        key_prefix: 'sk_live_abc',
        created_at: '2026-07-09T12:00:00Z',
        expires_at: null,
        revoked_at: null,
      };

      dbMock.get.mockResolvedValueOnce(mockKey);

      const result = await repo.findActiveByHash('hash123');

      expect(result).toEqual(mockKey);
      expect(dbMock.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM api_keys'),
        ['hash123', expect.any(String)]
      );
    });

    it('should return null if not found', async () => {
      dbMock.get.mockResolvedValueOnce(undefined);
      const result = await repo.findActiveByHash('invalid-hash');
      expect(result).toBeNull();
    });
  });
});
