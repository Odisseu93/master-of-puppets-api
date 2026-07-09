import v from 'vkrun';
import { ExecutionController } from '../controllers/execution.controller';
import { authMiddleware } from '../middleware/auth.middleware';

export const executionRouter = v.Router();

// Rate limiter middleware (30 requests per minute)
const limiter = v.rateLimit({
  windowMs: 60000,
  limit: 30,
});

// Protected routes
executionRouter.post('/v1/executions', limiter, authMiddleware, ExecutionController.createExecution);
executionRouter.get('/v1/executions/:id', limiter, authMiddleware, ExecutionController.getExecution);
