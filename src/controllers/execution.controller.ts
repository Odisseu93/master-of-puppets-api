import v from 'vkrun';
import { startScriptExecution } from '../services/executor.service';
import { getDatabase } from '../database';
import { logger } from '../utils/logger';
import { sendJson } from '../utils/response';
import { Execution } from '../types';

export class ExecutionController {
  static async createExecution(req: v.Request, res: v.Response) {
    const { script, arguments: args } = req.body || {};

    if (!script || typeof script !== 'string') {
      sendJson(res, 400, { error: 'Parameter "script" is required and must be a non-empty string.' });
      return;
    }

    if (args !== undefined && (!Array.isArray(args) || !args.every(a => typeof a === 'string'))) {
      sendJson(res, 400, { error: 'Parameter "arguments" must be an array of strings if provided.' });
      return;
    }

    try {
      const executionId = await startScriptExecution(script, args || []);
      sendJson(res, 202, { id: executionId, status: 'running' });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error({ err: error, script, args }, 'Failed to start script execution');
      sendJson(res, 400, { error: errorMsg });
    }
  }

  static async getExecution(req: v.Request, res: v.Response) {
    const { id } = req.params as Record<string, string | undefined>;

    if (!id) {
      sendJson(res, 400, { error: 'Parameter "id" is required.' });
      return;
    }

    try {
      const db = await getDatabase();
      const execution = await db.get<Execution>('SELECT * FROM executions WHERE id = ?', [id]);

      if (!execution) {
        sendJson(res, 404, { error: 'Execution not found.' });
        return;
      }

      let parsedArgs: string[] = [];
      try {
        parsedArgs = JSON.parse(execution.arguments);
      } catch {
        parsedArgs = [];
      }

      sendJson(res, 200, {
        id: execution.id,
        script_name: execution.script_name,
        arguments: parsedArgs,
        status: execution.status,
        exit_code: execution.exit_code,
        stdout: execution.stdout,
        stderr: execution.stderr,
        started_at: execution.started_at,
        finished_at: execution.finished_at,
      });
    } catch (error) {
      logger.error({ err: error, id }, 'Failed to retrieve execution status');
      sendJson(res, 500, { error: 'Internal server error while processing the request.' });
    }
  }
}
