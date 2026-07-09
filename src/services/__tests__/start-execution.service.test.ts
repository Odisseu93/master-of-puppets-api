import { StartExecutionService } from '../start-execution.service';
import { IExecutionRepository } from '../../repositories/execution.repository';


jest.mock('child_process', () => ({
  spawn: jest.fn().mockReturnValue({
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn(),
  }),
}));

describe('StartExecutionService', () => {
  let executionRepoMock: jest.Mocked<IExecutionRepository>;
  let service: StartExecutionService;

  beforeEach(() => {
    executionRepoMock = {
      create: jest.fn(),
      findById: jest.fn(),
      updateStatus: jest.fn(),
    };
    service = new StartExecutionService(executionRepoMock);
  });

  describe('getSafeScriptPath', () => {
    it('should throw error if path traverses directory', () => {
      expect(() => service['getSafeScriptPath']('../secret.txt')).toThrow('Access denied: directory traversal detected.');
    });
  });

  describe('execute', () => {
    it('should start execution and return id', async () => {
      const mockId = 'mock-id';
      executionRepoMock.create.mockResolvedValueOnce(mockId);
      
      // Mock safe script path check
      jest.spyOn(service as unknown as { getSafeScriptPath: () => string }, 'getSafeScriptPath').mockReturnValue('/safe/path.sh');

      const result = await service.execute('test.sh', []);

      expect(result).toBe(mockId);
      expect(executionRepoMock.create).toHaveBeenCalled();
    });
  });
});
