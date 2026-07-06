import { env } from './utils/env';
import { createApp } from './app';

const app = createApp();

app.server().listen(env.PORT, () => {
  console.log(`Server running at http://localhost:${env.PORT}`);
});
