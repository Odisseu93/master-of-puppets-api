process.env.DATABASE_PATH = ':memory:';
import path from 'path';
const TEST_SCRIPTS_DIR = path.resolve(__dirname, 'test-scripts');
process.env.SCRIPTS_DIR = TEST_SCRIPTS_DIR;

import fs from 'fs';
import cp from 'child_process';
import { Database } from 'sqlite';
import { getDatabase, closeDatabase } from '../database';

// Require the service to guarantee env variables are set beforehand
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getSafeScriptPath, startScriptExecution } = require('../services/executor.service');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function waitForExecution(db: Database, id: string, timeoutMs = 5000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const execution = await db.get('SELECT * FROM executions WHERE id = ?', [id]);
    if (execution && execution.status !== 'running') {
      return execution;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Execution ${id} timed out (still running after ${timeoutMs}ms)`);
}

describe('Executor Service', () => {
  let db: Database;

  beforeAll(async () => {
    // Create test-scripts directory
    if (!fs.existsSync(TEST_SCRIPTS_DIR)) {
      fs.mkdirSync(TEST_SCRIPTS_DIR, { recursive: true });
    }

    // Create success.sh
    fs.writeFileSync(
      path.join(TEST_SCRIPTS_DIR, 'success.sh'),
      `#!/bin/bash\necho "Success stdout"\necho "Arguments: $@"\nexit 0\n`,
      { mode: 0o755 }
    );

    // Create fail.sh
    fs.writeFileSync(
      path.join(TEST_SCRIPTS_DIR, 'fail.sh'),
      `#!/bin/bash\necho "Failure stderr" >&2\nexit 1\n`,
      { mode: 0o755 }
    );

    // Create huge-output.sh
    fs.writeFileSync(
      path.join(TEST_SCRIPTS_DIR, 'huge-output.sh'),
      `#!/bin/bash\nhead -c 250000 < /dev/zero | tr '\\0' 'A'\nexit 0\n`,
      { mode: 0o755 }
    );

    // Create test-script.sh
    fs.writeFileSync(
      path.join(TEST_SCRIPTS_DIR, 'test-script.sh'),
      `#!/bin/bash\necho "Test script"\nexit 0\n`,
      { mode: 0o755 }
    );

    // Create no-exec.xyz (no execute permission, doesn't end with .sh)
    fs.writeFileSync(
      path.join(TEST_SCRIPTS_DIR, 'no-exec.xyz'),
      `#!/bin/bash\necho "Should not run"\n`,
      { mode: 0o644 }
    );

    db = await getDatabase();
  });

  beforeEach(async () => {
    await db.run('DELETE FROM executions');
  });

  afterAll(async () => {
    await closeDatabase();
    // Clean up test-scripts directory and files
    if (fs.existsSync(TEST_SCRIPTS_DIR)) {
      fs.rmSync(TEST_SCRIPTS_DIR, { recursive: true, force: true });
    }
  });

  describe('getSafeScriptPath', () => {
    it('should throw an error if script path attempts directory traversal', () => {
      expect(() => {
        getSafeScriptPath('../../../etc/passwd');
      }).toThrow('Access denied: directory traversal detected.');

      expect(() => {
        getSafeScriptPath('/etc/passwd');
      }).toThrow('Access denied: directory traversal detected.');
    });

    it('should throw an error for non-existent scripts', () => {
      expect(() => {
        getSafeScriptPath('non-existent-script-xyz.sh');
      }).toThrow('Script not found');
    });

    it('should resolve and return path for existing safe scripts', () => {
      const safePath = getSafeScriptPath('test-script.sh');
      const expectedPath = path.resolve(TEST_SCRIPTS_DIR, 'test-script.sh');
      expect(safePath).toBe(expectedPath);
    });
  });

  describe('startScriptExecution', () => {
    it('should execute a successful script and update status to completed', async () => {
      const executionId = await startScriptExecution('success.sh', ['arg1', 'arg2']);
      expect(executionId).toBeDefined();

      const initialRecord = await db.get('SELECT * FROM executions WHERE id = ?', [executionId]);
      expect(initialRecord).toBeDefined();
      expect(initialRecord.status).toBe('running');
      expect(JSON.parse(initialRecord.arguments)).toEqual(['arg1', 'arg2']);

      const finalRecord = await waitForExecution(db, executionId);
      expect(finalRecord.status).toBe('completed');
      expect(finalRecord.exit_code).toBe(0);
      expect(finalRecord.stdout).toContain('Success stdout');
      expect(finalRecord.stdout).toContain('Arguments: arg1 arg2');
      expect(finalRecord.stderr).toBe('');
      expect(finalRecord.finished_at).toBeDefined();
    });

    it('should execute a failing script and update status to failed', async () => {
      const executionId = await startScriptExecution('fail.sh', []);
      const finalRecord = await waitForExecution(db, executionId);

      expect(finalRecord.status).toBe('failed');
      expect(finalRecord.exit_code).toBe(1);
      expect(finalRecord.stderr).toContain('Failure stderr');
      expect(finalRecord.stdout).toBe('');
      expect(finalRecord.finished_at).toBeDefined();
    });

    it('should truncate stdout when output exceeds maximum log size', async () => {
      const executionId = await startScriptExecution('huge-output.sh', []);
      const finalRecord = await waitForExecution(db, executionId);

      expect(finalRecord.status).toBe('completed');
      expect(finalRecord.stdout.length).toBeGreaterThan(200000);
      expect(finalRecord.stdout).toContain('[Logs truncated due to size limit]');
    });

    it('should update status to failed when child process fails to spawn', async () => {
      const executionId = await startScriptExecution('no-exec.xyz', []);
      const finalRecord = await waitForExecution(db, executionId);

      expect(finalRecord.status).toBe('failed');
      expect(finalRecord.stderr).toContain('Failed to start process:');
      expect(finalRecord.finished_at).toBeDefined();
    });
  });

  describe('Cross-platform Script Execution Simulation', () => {
    let spawnSpy: jest.SpyInstance;
    const originalPlatform = process.platform;

    beforeEach(() => {
      const mockChildProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn()
      };
      spawnSpy = jest.spyOn(cp, 'spawn').mockReturnValue(mockChildProcess as unknown as cp.ChildProcess);
    });

    afterEach(() => {
      spawnSpy.mockRestore();
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true
      });
    });

    it('should use bash with shell on Windows when script ends with .sh', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true
      });

      await startScriptExecution('success.sh', ['hello']);

      expect(spawnSpy).toHaveBeenCalledWith(
        'bash',
        [expect.stringContaining('success.sh'), 'hello'],
        { shell: true }
      );
    });

    it('should use /bin/bash on non-Windows when script ends with .sh', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });

      await startScriptExecution('success.sh', ['hello']);

      expect(spawnSpy).toHaveBeenCalledWith(
        '/bin/bash',
        [expect.stringContaining('success.sh'), 'hello']
      );
    });

    it('should use cmd.exe on Windows when script ends with .bat', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true
      });

      fs.writeFileSync(path.join(TEST_SCRIPTS_DIR, 'test.bat'), 'echo 123');

      await startScriptExecution('test.bat', ['hello']);

      expect(spawnSpy).toHaveBeenCalledWith(
        'cmd.exe',
        ['/c', expect.stringContaining('test.bat'), 'hello'],
        { shell: true }
      );
    });

    it('should use cmd.exe on Windows when script ends with .cmd', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true
      });

      fs.writeFileSync(path.join(TEST_SCRIPTS_DIR, 'test.cmd'), 'echo 123');

      await startScriptExecution('test.cmd', ['hello']);

      expect(spawnSpy).toHaveBeenCalledWith(
        'cmd.exe',
        ['/c', expect.stringContaining('test.cmd'), 'hello'],
        { shell: true }
      );
    });

    it('should use powershell.exe on Windows when script ends with .ps1', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true
      });

      fs.writeFileSync(path.join(TEST_SCRIPTS_DIR, 'test.ps1'), 'echo 123');

      await startScriptExecution('test.ps1', ['hello']);

      expect(spawnSpy).toHaveBeenCalledWith(
        'powershell.exe',
        ['-File', expect.stringContaining('test.ps1'), 'hello'],
        { shell: true }
      );
    });

    it('should use shell options on Windows for any other file extension', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true
      });

      fs.writeFileSync(path.join(TEST_SCRIPTS_DIR, 'test.xyz'), 'echo 123');

      await startScriptExecution('test.xyz', ['hello']);

      expect(spawnSpy).toHaveBeenCalledWith(
        expect.stringContaining('test.xyz'),
        ['hello'],
        { shell: true }
      );
    });
  });
});
