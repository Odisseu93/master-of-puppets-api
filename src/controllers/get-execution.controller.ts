import v from 'vkrun';
import { GetExecutionService } from '../services/get-execution.service';
import { sendJson } from '../utils/response';

export class GetExecutionController {
  constructor(private getExecutionService: GetExecutionService) {}

  async handle(req: v.Request, res: v.Response) {
    const { id } = req.params as { id: string };

    try {
      const execution = await this.getExecutionService.execute(id);
      let parsedArgs = [];
      try {
        parsedArgs = JSON.parse(execution.arguments);
      } catch {
        // Fallback
      }
      sendJson(res, 200, {
        ...execution,
        arguments: parsedArgs,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Execution not found') {
        sendJson(res, 404, { error: 'Execution not found' });
      } else {
        sendJson(res, 500, { error: 'Internal server error' });
      }
    }
  }
}
