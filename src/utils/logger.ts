import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { env } from './env';

const logDir = path.resolve(process.cwd(), 'logs');

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFilePath = path.join(logDir, 'api.log');

// Setup pino to write to stdout and to the local log file
const streams = [
  { stream: process.stdout },
  { stream: fs.createWriteStream(logFilePath, { flags: 'a' }) }
];

export const logger = pino(
  {
    level: env.LOG_LEVEL,
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.multistream(streams)
);
