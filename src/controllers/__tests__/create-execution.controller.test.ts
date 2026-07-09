import { CreateExecutionController } from '../create-execution.controller';
import { StartExecutionService } from '../../services/start-execution.service';
import v from 'vkrun';

describe('CreateExecutionController', () => {
  let serviceMock: jest.Mocked<StartExecutionService>;
  let controller: CreateExecutionController;
  let req: Partial<v.Request>;
  let res: Partial<v.Response>;

  beforeEach(() => {
    serviceMock = {
      execute: jest.fn(),
      getSafeScriptPath: jest.fn()
    } as unknown as jest.Mocked<StartExecutionService>;
    
    controller = new CreateExecutionController(serviceMock);
    
    req = { body: { script: 'test.sh', arguments: ['a'] } };
    res = {
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      send: jest.fn(),
    };
  });

  it('should return 400 if script is missing or invalid type', async () => {
    req.body.script = 123;
    await controller.handle(req as v.Request, res as v.Response);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('is required and must be a string'));
  });

  it('should start execution and return 202', async () => {
    serviceMock.execute.mockResolvedValueOnce('uuid-1');

    await controller.handle(req as v.Request, res as v.Response);

    expect(serviceMock.execute).toHaveBeenCalledWith('test.sh', ['a']);
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('uuid-1'));
  });
});
