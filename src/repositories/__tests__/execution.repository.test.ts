import { ExecutionRepository } from '../execution.repository';
import { Database } from 'sqlite';

describe('ExecutionRepository', () => {
  let dbMock: jest.Mocked<Database>;
  let repo: ExecutionRepository;

  beforeEach(() => {
    // Mock the sqlite Database interface
    dbMock = {
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(),
      exec: jest.fn(),
      close: jest.fn(),
    } as unknown as jest.Mocked<Database>;

    repo = new ExecutionRepository(dbMock);
  });

  describe('create', () => {
    it('should insert a new execution and return its id', async () => {
      const data = {
        script_name: 'test.sh',
        arguments: '["arg1"]',
        started_at: '2026-07-09T12:00:00Z',
      };

      dbMock.run.mockResolvedValueOnce({} as unknown as never);

      const id = await repo.create(data);

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(dbMock.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO executions'),
        expect.arrayContaining([id, data.script_name, data.arguments, data.started_at])
      );
    });
  });

  describe('findById', () => {
    it('should return the execution if found', async () => {
      const mockExec = { id: 'uuid-1', script_name: 'test.sh' };
      dbMock.get.mockResolvedValueOnce(mockExec);

      const result = await repo.findById('uuid-1');

      expect(result).toEqual(mockExec);
      expect(dbMock.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM executions WHERE id = ?'),
        ['uuid-1']
      );
    });

    it('should return null if not found', async () => {
      dbMock.get.mockResolvedValueOnce(undefined);
      const result = await repo.findById('uuid-2');
      expect(result).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('should update the execution status and finished_at time', async () => {
      dbMock.run.mockResolvedValueOnce({} as unknown as never);

      await repo.updateStatus('uuid-1', 'failed', 'some error', 1, 'output');

      expect(dbMock.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE executions'),
        expect.arrayContaining(['failed', 1, 'output', 'some error', expect.any(String), 'uuid-1'])
      );
    });
  });
});
