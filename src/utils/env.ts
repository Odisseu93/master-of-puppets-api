import { schema, loadEnv, InferOut } from 'vkrun';

// Load variables from `.env` file into process.env at module startup
loadEnv();

const envSchema = schema().object({
  PORT: schema().number().default(3000),
  NODE_ENV: schema().string().default('development'),
  DATABASE_PATH: schema().string().default('database.sqlite'),
  SCRIPTS_DIR: schema().string().default('./host-scripts'),
  LOG_LEVEL: schema().string().default('info'),
  CORS_ORIGIN: schema().string().default('*'),
});

export type Env = InferOut<typeof envSchema>;

function getParsedEnv(): Env {
  const rawPort = process.env.PORT;
  const port = rawPort !== undefined && rawPort !== '' ? Number(rawPort) : undefined;
  
  const rawObj = {
    PORT: port,
    NODE_ENV: process.env.NODE_ENV || undefined,
    DATABASE_PATH: process.env.DATABASE_PATH || undefined,
    SCRIPTS_DIR: process.env.SCRIPTS_DIR || undefined,
    LOG_LEVEL: process.env.LOG_LEVEL || undefined,
    CORS_ORIGIN: process.env.CORS_ORIGIN || undefined,
  };

  return envSchema.parse(rawObj) as Env;
}

export const env = new Proxy({} as Env, {
  get(_, prop: keyof Env) {
    return getParsedEnv()[prop];
  }
});
