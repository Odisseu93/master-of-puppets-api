import { env } from './utils/env';
import { logger } from './utils/logger';
import { createApp } from './app';

const app = createApp();

app.server().listen(env.PORT, () => {
  logger.info(`Server running at http://localhost:${env.PORT}`);
});
