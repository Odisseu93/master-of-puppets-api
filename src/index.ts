import { createApp } from './app';

const PORT = Number(process.env.PORT) || 3000;
const app = createApp();

app.server().listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
