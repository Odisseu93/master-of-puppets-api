import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { IExecutionRepository } from '../repositories/execution.repository';
import { logger } from '../utils/logger';
import { env } from '../utils/env';

const SCRIPTS_DIR = path.resolve(process.cwd(), env.SCRIPTS_DIR);
const MAX_LOG_SIZE = 200000;

export class StartExecutionService {
  constructor(private executionRepo: IExecutionRepository) {}

  public getSafeScriptPath(scriptName: string): string {
    const resolvedBase = path.resolve(SCRIPTS_DIR);
    const resolvedTarget = path.resolve(resolvedBase, scriptName);

    if (!resolvedTarget.startsWith(resolvedBase)) {
      throw new Error('Access denied: directory traversal detected.');
    }

    if (!fs.existsSync(resolvedTarget)) {
      throw new Error(`Script not found: ${scriptName}`);
    }

    const stats = fs.statSync(resolvedTarget);
    if (!stats.isFile()) {
      throw new Error('The target path is not a valid file.');
    }

    return resolvedTarget;
  }

  async execute(scriptName: string, args: string[]): Promise<string> {
    const scriptPath = this.getSafeScriptPath(scriptName);
    
    const startedAt = new Date().toISOString();
    
    const executionId = await this.executionRepo.create({
      script_name: scriptName,
      arguments: JSON.stringify(args),
      started_at: startedAt
    });

    this.runProcessInBackground(executionId, scriptPath, args).catch(err => {
      logger.error({ err, executionId }, `Fatal failure during execution ${executionId}`);
    });

    return executionId;
  }

  private async runProcessInBackground(
    executionId: string,
    scriptPath: string,
    args: string[]
  ): Promise<void> {
    let childProcess;
    const isWindows = process.platform === 'win32';

    if (scriptPath.endsWith('.sh')) {
      if (isWindows) {
        childProcess = spawn('bash', [scriptPath, ...args], { shell: true });
      } else {
        childProcess = spawn('/bin/bash', [scriptPath, ...args]);
      }
    } else if (isWindows && (scriptPath.endsWith('.bat') || scriptPath.endsWith('.cmd'))) {
      childProcess = spawn('cmd.exe', ['/c', scriptPath, ...args], { shell: true });
    } else if (isWindows && scriptPath.endsWith('.ps1')) {
      childProcess = spawn('powershell.exe', ['-File', scriptPath, ...args], { shell: true });
    } else {
      childProcess = spawn(scriptPath, args, { shell: isWindows });
    }

    let stdoutAcc = '';
    let stderrAcc = '';

    childProcess.stdout.on('data', (chunk) => {
      if (stdoutAcc.length < MAX_LOG_SIZE) {
        stdoutAcc += chunk.toString();
        if (stdoutAcc.length >= MAX_LOG_SIZE) {
          stdoutAcc = stdoutAcc.slice(0, MAX_LOG_SIZE) + '\n[Logs truncated due to size limit]';
        }
      }
    });

    childProcess.stderr.on('data', (chunk) => {
      if (stderrAcc.length < MAX_LOG_SIZE) {
        stderrAcc += chunk.toString();
        if (stderrAcc.length >= MAX_LOG_SIZE) {
          stderrAcc = stderrAcc.slice(0, MAX_LOG_SIZE) + '\n[Logs truncated due to size limit]';
        }
      }
    });

    let hasError = false;

    childProcess.on('error', async (error) => {
      hasError = true;
      const errorMsg = `Failed to start process: ${error.message}\n` + stderrAcc;

      try {
        await this.executionRepo.updateStatus(
          executionId,
          'failed',
          errorMsg.slice(0, MAX_LOG_SIZE)
        );
      } catch (dbErr) {
        logger.warn({ dbErr, executionId }, 'Failed to update execution status in database (connection likely closed)');
      }
    });

    childProcess.on('close', async (code) => {
      if (hasError) return;
      const finalStatus = code === 0 ? 'completed' : 'failed';

      try {
        await this.executionRepo.updateStatus(
          executionId,
          finalStatus,
          stderrAcc,
          code,
          stdoutAcc
        );
      } catch (dbErr) {
        logger.warn({ dbErr, executionId }, 'Failed to save execution result to database (connection likely closed)');
      }
    });
  }
}
