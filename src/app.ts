import v from 'vkrun';
import { requestLoggerMiddleware } from './middleware/logger.middleware';
import { setupCors } from './middleware/cors.middleware';
import { registerRoutes } from './routes';

/**
 * Creates and configures the VkrunJS application.
 */
export function createApp(): ReturnType<typeof v.App> {
  const app = v.App();

  // Enable request body, query, and parameter parsing
  app.parseData();

  // Enable global request logging
  app.use(requestLoggerMiddleware);

  // Setup and apply CORS middleware
  const { preCorsMiddleware, corsMiddleware } = setupCors();
  if (preCorsMiddleware) {
    app.use(preCorsMiddleware);
  }
  app.use(corsMiddleware);

  // Register all routes
  registerRoutes(app);

  return app;
}
