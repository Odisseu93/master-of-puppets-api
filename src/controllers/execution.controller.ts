import v from 'vkrun';
import { startScriptExecution } from '../services/executor.service';
import { getDatabase } from '../database';
import { logger } from '../utils/logger';

export class ExecutionController {
  static async createExecution(req: v.Request, res: v.Response) {
    res.setHeader('Content-Type', 'application/json');

    const { script, arguments: args } = req.body || {};

    if (!script || typeof script !== 'string') {
      res.status(400).send(JSON.stringify({ error: 'Parâmetro "script" é obrigatório e deve ser uma string.' }));
      return;
    }

    if (args !== undefined && (!Array.isArray(args) || !args.every(a => typeof a === 'string'))) {
      res.status(400).send(JSON.stringify({ error: 'Parâmetro "arguments" deve ser um array de strings se fornecido.' }));
      return;
    }

    try {
      const executionId = await startScriptExecution(script, args || []);
      res.status(202).send(JSON.stringify({
        id: executionId,
        status: 'running'
      }));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error({ err: error, script, args }, 'Erro ao iniciar execução de script');
      res.status(400).send(JSON.stringify({ error: errorMsg }));
    }
  }

  static async getExecution(req: v.Request, res: v.Response) {
    res.setHeader('Content-Type', 'application/json');
    const { id } = req.params as Record<string, string | undefined>;

    if (!id) {
      res.status(400).send(JSON.stringify({ error: 'Parâmetro ID é obrigatório.' }));
      return;
    }

    try {
      const db = await getDatabase();
      const execution = await db.get('SELECT * FROM executions WHERE id = ?', [id]);

      if (!execution) {
        res.status(404).send(JSON.stringify({ error: 'Execução não encontrada.' }));
        return;
      }

      let parsedArgs = [];
      try {
        parsedArgs = JSON.parse(execution.arguments);
      } catch {
        parsedArgs = [];
      }

      res.status(200).send(JSON.stringify({
        id: execution.id,
        script_name: execution.script_name,
        arguments: parsedArgs,
        status: execution.status,
        exit_code: execution.exit_code,
        stdout: execution.stdout,
        stderr: execution.stderr,
        started_at: execution.started_at,
        finished_at: execution.finished_at
      }));
    } catch (error) {
      logger.error({ err: error, id }, 'Erro ao consultar status da execução');
      res.status(500).send(JSON.stringify({ error: 'Erro interno ao processar a consulta.' }));
    }
  }
}
