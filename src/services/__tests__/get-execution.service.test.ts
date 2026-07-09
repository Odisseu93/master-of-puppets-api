import { GetExecutionService } from '../get-execution.service';
import { IExecutionRepository } from '../../repositories/execution.repository';
import { Execution } from '../../types';

describe('GetExecutionService', () => {
  let executionRepoMock: jest.Mocked<IExecutionRepository>;
  let service: GetExecutionService;

  beforeEach(() => {
    executionRepoMock = {
      create: jest.fn(),
      findById: jest.fn(),
      updateStatus: jest.fn(),
    };
    service = new GetExecutionService(executionRepoMock);
  });

  it('should return the execution if found', async () => {
    const mockExec: Execution = {
      id: 'uuid-1',
      script_name: 'test',
      arguments: '[]',
      status: 'completed',
      exit_code: 0,
      stdout: 'ok',
      stderr: '',
      started_at: '2026',
      finished_at: '2026',
    };
    executionRepoMock.findById.mockResolvedValueOnce(mockExec);

    const result = await service.execute('uuid-1');
    expect(result).toEqual(mockExec);
    expect(executionRepoMock.findById).toHaveBeenCalledWith('uuid-1');
  });

  it('should throw an error if execution is not found', async () => {
    executionRepoMock.findById.mockResolvedValueOnce(null);

    await expect(service.execute('invalid')).rejects.toThrow('Execution not found');
  });
});
