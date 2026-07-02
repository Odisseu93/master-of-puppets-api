import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let dbInstance: Database | null = null;

/**
 * Gets the active SQLite database instance, initializing it if necessary.
 */
export async function getDatabase(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  const rawPath = process.env.DATABASE_PATH || 'database.sqlite';
  const dbPath = rawPath === ':memory:' ? ':memory:' : path.resolve(process.cwd(), rawPath);
  
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await initDatabase(dbInstance);

  return dbInstance;
}

/**
 * Closes the active database instance and resets the cache.
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Initializes database schemas if they do not exist.
 */
async function initDatabase(db: Database): Promise<void> {
  // Enable foreign keys
  await db.exec('PRAGMA foreign_keys = ON;');

  // Create api_keys table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      key_hash TEXT UNIQUE NOT NULL,
      key_prefix TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      revoked_at DATETIME
    );
  `);

  // Create executions table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS executions (
      id TEXT PRIMARY KEY,
      script_name TEXT NOT NULL,
      arguments TEXT NOT NULL, -- Stored as a JSON string array
      status TEXT NOT NULL,    -- 'running', 'completed', 'failed'
      exit_code INTEGER,
      stdout TEXT,
      stderr TEXT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME
    );
  `);
}
