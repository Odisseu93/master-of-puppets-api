import v from 'vkrun';
import { healthRouter } from './health.routes';
import { executionRouter } from './execution.routes';

export function registerRoutes(app: ReturnType<typeof v.App>) {
  app.use(healthRouter);
  app.use(executionRouter);
}
