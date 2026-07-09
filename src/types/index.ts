/**
 * Represents a script execution record stored in the database.
 */
export interface Execution {
  id: string;
  script_name: string;
  arguments: string; // JSON-encoded string array
  status: 'running' | 'completed' | 'failed';
  exit_code: number | null;
  stdout: string;
  stderr: string;
  started_at: string; // ISO 8601
  finished_at: string | null; // ISO 8601
}

/**
 * Represents an API key record stored in the database.
 */
export interface ApiKey {
  id: number;
  name: string;
  key_hash: string;
  key_prefix: string;
  created_at: string; // ISO 8601
  expires_at: string | null; // ISO 8601
  revoked_at: string | null; // ISO 8601
}
