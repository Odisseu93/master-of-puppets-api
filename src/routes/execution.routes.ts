import v from 'vkrun';

import { Database } from 'sqlite';
import { ExecutionRepository } from '../repositories/execution.repository';
import { ApiKeyRepository } from '../repositories/api-key.repository';
import { StartExecutionService } from '../services/start-execution.service';
import { GetExecutionService } from '../services/get-execution.service';
import { CreateExecutionController } from '../controllers/create-execution.controller';
import { GetExecutionController } from '../controllers/get-execution.controller';
import { createAuthMiddleware } from '../middleware/auth.middleware';

export function executionRouter(db: Database) {
  const router = v.Router();

  // Rate limiter middleware (15 requests per minute)
  const limiter = v.rateLimit({
    windowMs: 60000,
    limit: 15,
  });

  // Repositories
  const executionRepo = new ExecutionRepository(db);
  const apiKeyRepo = new ApiKeyRepository(db);

  // Services
  const startService = new StartExecutionService(executionRepo);
  const getService = new GetExecutionService(executionRepo);

  // Controllers
  const createController = new CreateExecutionController(startService);
  const getController = new GetExecutionController(getService);

  // Middleware
  const authMw = createAuthMiddleware(apiKeyRepo);

  // Protected routes
  router.post('/v1/executions', limiter, authMw, createController.handle.bind(createController));
  router.get('/v1/executions/:id', limiter, authMw, getController.handle.bind(getController));

  return router;
}
