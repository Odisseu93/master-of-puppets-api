import v from 'vkrun';
import { authMiddleware } from './middleware/auth.middleware';
import { startScriptExecution } from './services/executor.service';
import { getDatabase } from './database';
import { requestLoggerMiddleware } from './middleware/logger.middleware';
import { logger } from './utils/logger';
import { env } from './utils/env';

/**
 * Creates and configures the VkrunJS application.
 */
export function createApp(): ReturnType<typeof v.App> {
  const app = v.App();

  // Enable request body, query, and parameter parsing
  app.parseData();

  // Enable CORS middleware
  const corsOriginEnv = env.CORS_ORIGIN;
  const origins = corsOriginEnv
    ? corsOriginEnv.trim() === '*'
      ? '*'
      : corsOriginEnv.includes(',')
        ? corsOriginEnv.split(',').map(o => o.trim())
        : [corsOriginEnv.trim()]
    : '*';

  if (origins !== '*') {
    const wildcards = origins.filter(o => o.includes('*') && o !== '*');
    if (wildcards.length > 0) {
      app.use((req: v.Request, res: v.Response, next: v.NextFunction) => {
        const requestOrigin = req.headers.origin;
        if (requestOrigin && !origins.includes(requestOrigin)) {
          for (const pattern of wildcards) {
            const regexStr = '^' + pattern
              .split('*')
              .map(part => part.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&'))
              .join('[^/]+') + '$';
            const regex = new RegExp(regexStr, 'i');
            if (regex.test(requestOrigin)) {
              origins.push(requestOrigin);
              break;
            }
          }
        }
        next();
      });
    }
  }

  app.use(v.cors({
    origin: origins,
  }));

  // Enable global request logging
  app.use(requestLoggerMiddleware);

  // Rate limiter middleware (30 requests per minute)
  const limiter = v.rateLimit({
    windowMs: 60000,
    limit: 30,
  });

  // Public routes
  app.get('/', (req: v.Request, res: v.Response) => {
    res.status(200).send('Hello World!');
  });

  app.get('/health', (req: v.Request, res: v.Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify({ status: 'ok' }));
  });

  // Protected route to start script execution
  app.post('/v1/executions', limiter, authMiddleware, async (req: v.Request, res: v.Response) => {
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
  });

  // Protected route to query execution status
  app.get('/v1/executions/:id', limiter, authMiddleware, async (req: v.Request, res: v.Response) => {
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
  });

  return app;
}
