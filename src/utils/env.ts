import { schema, loadEnv, InferOut } from 'vkrun';

// Load initial variables from .env if present
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

let cachedEnv: Env | null = null;
let lastProcessEnvStr = '';

export const env = new Proxy({} as Env, {
  get(_, prop: keyof Env) {
    const currentEnvStr = JSON.stringify({
      PORT: process.env.PORT,
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_PATH: process.env.DATABASE_PATH,
      SCRIPTS_DIR: process.env.SCRIPTS_DIR,
      LOG_LEVEL: process.env.LOG_LEVEL,
      CORS_ORIGIN: process.env.CORS_ORIGIN,
    });

    if (cachedEnv && currentEnvStr === lastProcessEnvStr) {
      return cachedEnv[prop];
    }

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

    cachedEnv = envSchema.parse(rawObj) as Env;
    lastProcessEnvStr = currentEnvStr;
    return cachedEnv[prop];
  }
});
