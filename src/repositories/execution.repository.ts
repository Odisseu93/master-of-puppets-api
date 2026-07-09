import { Database } from 'sqlite';
import crypto from 'crypto';
import { Execution } from '../types';

export interface IExecutionRepository {
  create(data: Omit<Execution, 'id' | 'status' | 'exit_code' | 'stdout' | 'stderr' | 'finished_at'>): Promise<string>;
  findById(id: string): Promise<Execution | null>;
  updateStatus(id: string, status: string, stderr?: string, exitCode?: number | null, stdout?: string): Promise<void>;
}

export class ExecutionRepository implements IExecutionRepository {
  constructor(private db: Database) {}

  async create(data: Omit<Execution, 'id' | 'status' | 'exit_code' | 'stdout' | 'stderr' | 'finished_at'>): Promise<string> {
    const id = crypto.randomUUID();
    await this.db.run(
      `INSERT INTO executions (id, script_name, arguments, status, exit_code, stdout, stderr, started_at)
       VALUES (?, ?, ?, 'running', NULL, '', '', ?)`,
      [id, data.script_name, data.arguments, data.started_at]
    );
    return id;
  }

  async findById(id: string): Promise<Execution | null> {
    const execution = await this.db.get<Execution>(
      'SELECT * FROM executions WHERE id = ?',
      [id]
    );
    return execution || null;
  }

  async updateStatus(id: string, status: string, stderr: string = '', exitCode: number | null = null, stdout: string = ''): Promise<void> {
    const finishedAt = new Date().toISOString();
    await this.db.run(
      `UPDATE executions 
       SET status = ?, exit_code = ?, stdout = ?, stderr = ?, finished_at = ?
       WHERE id = ?`,
      [status, exitCode, stdout, stderr, finishedAt, id]
    );
  }
}
