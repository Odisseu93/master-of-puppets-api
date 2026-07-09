import { GetExecutionController } from '../get-execution.controller';
import { GetExecutionService } from '../../services/get-execution.service';
import v from 'vkrun';

describe('GetExecutionController', () => {
  let serviceMock: jest.Mocked<GetExecutionService>;
  let controller: GetExecutionController;
  let req: Partial<v.Request>;
  let res: Partial<v.Response>;

  beforeEach(() => {
    serviceMock = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<GetExecutionService>;
    
    controller = new GetExecutionController(serviceMock);
    
    req = { params: { id: 'uuid-1' } };
    res = {
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      send: jest.fn(),
    };
  });

  it('should return 200 and the execution', async () => {
    const execMock = { id: 'uuid-1', status: 'completed', arguments: '[]' };
    serviceMock.execute.mockResolvedValueOnce(execMock as unknown as ReturnType<typeof serviceMock.execute>);

    await controller.handle(req as v.Request, res as v.Response);

    expect(serviceMock.execute).toHaveBeenCalledWith('uuid-1');
    expect(res.status).toHaveBeenCalledWith(200);
    const expectedResponse = { id: 'uuid-1', status: 'completed', arguments: [] };
    expect(res.send).toHaveBeenCalledWith(JSON.stringify(expectedResponse));
  });

  it('should return 404 if execution not found', async () => {
    serviceMock.execute.mockRejectedValueOnce(new Error('Execution not found'));

    await controller.handle(req as v.Request, res as v.Response);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Execution not found'));
  });
});
