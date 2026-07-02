import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getDatabase } from '../database';

const SCRIPTS_DIR = path.resolve(process.cwd(), process.env.SCRIPTS_DIR || './host-scripts');
const MAX_LOG_SIZE = 200000; // Limit logs to ~200KB to avoid excessive SQLite bloat

/**
 * Validates the script name and returns the absolute safe path.
 * Prevents Directory Traversal.
 */
export function getSafeScriptPath(scriptName: string): string {
  const resolvedBase = path.resolve(SCRIPTS_DIR);
  const resolvedTarget = path.resolve(resolvedBase, scriptName);

  // Directory Traversal guard
  if (!resolvedTarget.startsWith(resolvedBase)) {
    throw new Error('Acesso negado: directory traversal detectado.');
  }

  // Existence check
  if (!fs.existsSync(resolvedTarget)) {
    throw new Error(`Script não encontrado: ${scriptName}`);
  }

  // Check if it's a file
  const stats = fs.statSync(resolvedTarget);
  if (!stats.isFile()) {
    throw new Error('O caminho alvo não é um arquivo válido.');
  }

  return resolvedTarget;
}

/**
 * Executes a shell script in the background, logging progress to SQLite.
 */
export async function startScriptExecution(scriptName: string, args: string[]): Promise<string> {
  // Validate path (will throw error if unsafe or non-existent)
  const scriptPath = getSafeScriptPath(scriptName);

  const executionId = crypto.randomUUID();
  const db = await getDatabase();

  const startedAt = new Date().toISOString();

  // Save initial status as running
  await db.run(
    `INSERT INTO executions (id, script_name, arguments, status, exit_code, stdout, stderr, started_at)
     VALUES (?, ?, ?, 'running', NULL, '', '', ?)`,
    [executionId, scriptName, JSON.stringify(args), startedAt]
  );

  // Run in background (do not await spawn close)
  runProcessInBackground(executionId, scriptPath, args).catch(err => {
    console.error(`Falha fatal na execução ${executionId}:`, err);
  });

  return executionId;
}

/**
 * Handles process spawning, data collection, and database updating.
 */
async function runProcessInBackground(
  executionId: string,
  scriptPath: string,
  args: string[]
): Promise<void> {
  const db = await getDatabase();

  let childProcess;
  // If shell script on Linux, explicitly execute with bash to ensure compatibility
  if (scriptPath.endsWith('.sh')) {
    childProcess = spawn('/bin/bash', [scriptPath, ...args]);
  } else {
    childProcess = spawn(scriptPath, args);
  }

  let stdoutAcc = '';
  let stderrAcc = '';

  childProcess.stdout.on('data', (chunk) => {
    if (stdoutAcc.length < MAX_LOG_SIZE) {
      stdoutAcc += chunk.toString();
    } else if (!stdoutAcc.endsWith('\n[Logs truncados devido ao limite de tamanho]')) {
      stdoutAcc += '\n[Logs truncados devido ao limite de tamanho]';
    }
  });

  childProcess.stderr.on('data', (chunk) => {
    if (stderrAcc.length < MAX_LOG_SIZE) {
      stderrAcc += chunk.toString();
    } else if (!stderrAcc.endsWith('\n[Logs truncados devido ao limite de tamanho]')) {
      stderrAcc += '\n[Logs truncados devido ao limite de tamanho]';
    }
  });

  childProcess.on('error', async (error) => {
    const finishedAt = new Date().toISOString();
    const errorMsg = `Erro ao iniciar processo: ${error.message}\n` + stderrAcc;
    
    await db.run(
      `UPDATE executions 
       SET status = 'failed', stderr = ?, finished_at = ?
       WHERE id = ?`,
      [errorMsg.slice(0, MAX_LOG_SIZE), finishedAt, executionId]
    );
  });

  childProcess.on('close', async (code) => {
    const finishedAt = new Date().toISOString();
    const finalStatus = code === 0 ? 'completed' : 'failed';

    await db.run(
      `UPDATE executions 
       SET status = ?, exit_code = ?, stdout = ?, stderr = ?, finished_at = ?
       WHERE id = ?`,
      [finalStatus, code, stdoutAcc, stderrAcc, finishedAt, executionId]
    );
  });
}
