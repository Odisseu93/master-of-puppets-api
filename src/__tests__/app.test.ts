process.env.DATABASE_PATH = ':memory:';
import path from 'path';
const TEST_SCRIPTS_DIR = path.resolve(__dirname, 'app-test-scripts');
process.env.SCRIPTS_DIR = TEST_SCRIPTS_DIR;

import fs from 'fs';
import crypto from 'crypto';
import { Database } from 'sqlite';
import { getDatabase, closeDatabase } from '../database';
import { createApp } from '../app';
import { Server } from 'http';

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

describe('API Endpoints (App Integration)', () => {
  let db: Database;
  let server: Server;
  let baseUrl: string;

  const validKeyPrefix = 'sk_live_apptest';
  const validKeySecret = 'supersecretapikey';
  const validFullKey = `${validKeyPrefix}.${validKeySecret}`;
  const validKeyHash = hashKey(validFullKey);

  const expiredFullKey = 'sk_live_appexpired.secret';
  const expiredKeyHash = hashKey(expiredFullKey);

  const revokedFullKey = 'sk_live_apprevoked.secret';
  const revokedKeyHash = hashKey(revokedFullKey);

  beforeAll(async () => {
    // 1. Setup test scripts
    if (!fs.existsSync(TEST_SCRIPTS_DIR)) {
      fs.mkdirSync(TEST_SCRIPTS_DIR, { recursive: true });
    }
    fs.writeFileSync(
      path.join(TEST_SCRIPTS_DIR, 'test-api.sh'),
      `#!/bin/bash\necho "API execution success"\nexit 0\n`,
      { mode: 0o755 }
    );

    // 2. Initialize DB & seed keys
    db = await getDatabase();
    await db.run('DELETE FROM api_keys');
    await db.run('DELETE FROM executions');

    // Seed active valid key
    await db.run(
      `INSERT INTO api_keys (name, key_hash, key_prefix, expires_at) VALUES (?, ?, ?, NULL)`,
      ['App Test Key', validKeyHash, validKeyPrefix]
    );

    // Seed expired key
    const expiredDate = new Date();
    expiredDate.setHours(expiredDate.getHours() - 1);
    await db.run(
      `INSERT INTO api_keys (name, key_hash, key_prefix, expires_at) VALUES (?, ?, ?, ?)`,
      ['Expired Key', expiredKeyHash, 'sk_live_appexpired', expiredDate.toISOString()]
    );

    // Seed revoked key
    await db.run(
      `INSERT INTO api_keys (name, key_hash, key_prefix, expires_at, revoked_at) VALUES (?, ?, ?, NULL, ?)`,
      ['Revoked Key', revokedKeyHash, 'sk_live_apprevoked', new Date().toISOString()]
    );

    // 3. Start App Server on random port
    const app = createApp();
    server = app.server();
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const address = server.address();
        if (address && typeof address !== 'string') {
          baseUrl = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Close server
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    // Close DB
    await closeDatabase();
    // Clean scripts
    if (fs.existsSync(TEST_SCRIPTS_DIR)) {
      fs.rmSync(TEST_SCRIPTS_DIR, { recursive: true, force: true });
    }
  });

  describe('Public Routes', () => {
    it('should return Hello World at GET /', async () => {
      const res = await fetch(`${baseUrl}/`);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toBe('Hello World!');
    });

    it('should return status ok at GET /health', async () => {
      const res = await fetch(`${baseUrl}/health`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');
      const body = await res.json() as { status: string };
      expect(body).toEqual({ status: 'ok' });
    });
  });

  describe('Authentication Check', () => {
    it('should return 401 when x-api-key header is missing', async () => {
      const res = await fetch(`${baseUrl}/v1/executions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: 'test-api.sh' }),
      });
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toContain('API Key is missing');
    });

    it('should return 401 when API Key is invalid', async () => {
      const res = await fetch(`${baseUrl}/v1/executions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'sk_live_wrong.secret',
        },
        body: JSON.stringify({ script: 'test-api.sh' }),
      });
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toContain('Invalid or expired API Key');
    });

    it('should return 401 when API Key is expired', async () => {
      const res = await fetch(`${baseUrl}/v1/executions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': expiredFullKey,
        },
        body: JSON.stringify({ script: 'test-api.sh' }),
      });
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toContain('Invalid or expired API Key');
    });

    it('should return 401 when API Key is revoked', async () => {
      const res = await fetch(`${baseUrl}/v1/executions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': revokedFullKey,
        },
        body: JSON.stringify({ script: 'test-api.sh' }),
      });
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toContain('Invalid or expired API Key');
    });
  });

  describe('POST /v1/executions', () => {
    it('should return 400 when script parameter is missing', async () => {
      const res = await fetch(`${baseUrl}/v1/executions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': validFullKey,
        },
        body: JSON.stringify({ arguments: [] }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as { error: string };
      expect(body.error).toContain('Parâmetro "script" é obrigatório');
    });

    it('should return 400 when arguments parameter is not string array', async () => {
      const res = await fetch(`${baseUrl}/v1/executions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': validFullKey,
        },
        body: JSON.stringify({ script: 'test-api.sh', arguments: [123] }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as { error: string };
      expect(body.error).toContain('Parâmetro "arguments" deve ser um array de strings');
    });

    it('should return 400 when script attempts directory traversal', async () => {
      const res = await fetch(`${baseUrl}/v1/executions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': validFullKey,
        },
        body: JSON.stringify({ script: '../etc/passwd' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as { error: string };
      expect(body.error).toContain('Acesso negado: directory traversal');
    });

    it('should successfully trigger execution and return 202', async () => {
      const res = await fetch(`${baseUrl}/v1/executions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': validFullKey,
        },
        body: JSON.stringify({ script: 'test-api.sh', arguments: ['hello'] }),
      });
      expect(res.status).toBe(202);
      const body = await res.json() as { id: string; status: string };
      expect(body.id).toBeDefined();
      expect(body.status).toBe('running');
    });
  });

  describe('GET /v1/executions/:id', () => {
    let testExecutionId: string;

    beforeAll(async () => {
      testExecutionId = crypto.randomUUID();
      // Seed a completed execution into database directly
      await db.run(
        `INSERT INTO executions (id, script_name, arguments, status, exit_code, stdout, stderr, started_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          testExecutionId,
          'test-api.sh',
          JSON.stringify(['dummy']),
          'completed',
          0,
          'Success log',
          '',
          new Date().toISOString(),
          new Date().toISOString()
        ]
      );
    });

    it('should return 404 for non-existent execution', async () => {
      const res = await fetch(`${baseUrl}/v1/executions/non-existent-id`, {
        headers: { 'x-api-key': validFullKey },
      });
      expect(res.status).toBe(404);
      const body = await res.json() as { error: string };
      expect(body.error).toContain('Execução não encontrada');
    });

    it('should return execution details for a valid ID', async () => {
      const res = await fetch(`${baseUrl}/v1/executions/${testExecutionId}`, {
        headers: { 'x-api-key': validFullKey },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as {
        id: string;
        script_name: string;
        arguments: string[];
        status: string;
        exit_code: number;
        stdout: string;
        stderr: string;
        started_at: string;
        finished_at: string;
      };
      expect(body.id).toBe(testExecutionId);
      expect(body.script_name).toBe('test-api.sh');
      expect(body.arguments).toEqual(['dummy']);
      expect(body.status).toBe('completed');
      expect(body.exit_code).toBe(0);
      expect(body.stdout).toBe('Success log');
      expect(body.stderr).toBe('');
      expect(body.started_at).toBeDefined();
      expect(body.finished_at).toBeDefined();
    });
  });
});
