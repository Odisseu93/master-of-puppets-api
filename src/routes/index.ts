import v from 'vkrun';
import { healthRouter } from './health.routes';
import { executionRouter } from './execution.routes';

import { Database } from 'sqlite';

export function registerRoutes(app: ReturnType<typeof v.App>, db: Database) {
  app.use(healthRouter);
  app.use(executionRouter(db));
}
