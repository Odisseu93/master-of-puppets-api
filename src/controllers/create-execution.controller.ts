import v from 'vkrun';
import { StartExecutionService } from '../services/start-execution.service';
import { sendJson } from '../utils/response';
import { logger } from '../utils/logger';

export class CreateExecutionController {
  constructor(private startExecutionService: StartExecutionService) {}

  async handle(req: v.Request, res: v.Response) {
    if (!req.body || typeof req.body !== 'object') {
      return sendJson(res, 400, { error: 'Request body is required and must be a JSON object' });
    }

    const { script, arguments: args } = req.body as { script?: unknown; arguments?: unknown };

    if (!script || typeof script !== 'string') {
      return sendJson(res, 400, { error: '"script" is required and must be a string' });
    }

    if (args !== undefined && (!Array.isArray(args) || !args.every(a => typeof a === 'string'))) {
      return sendJson(res, 400, { error: '"arguments" must be an array of strings' });
    }

    try {
      const executionId = await this.startExecutionService.execute(script, args || []);
      sendJson(res, 202, {
        id: executionId,
        status: 'running',
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message.includes('directory traversal') ||
        error.message.includes('not found') ||
        error.message.includes('not a valid file'))
      ) {
        return sendJson(res, 400, { error: error.message });
      }

      logger.error({ err: error, script }, 'Failed to start execution');
      sendJson(res, 500, { error: 'Internal server error while starting execution' });
    }
  }
}
