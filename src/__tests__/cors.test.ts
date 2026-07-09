process.env.DATABASE_PATH = ':memory:';

import { createApp } from '../app';
import { Server } from 'http';

describe('CORS Middleware', () => {
  let servers: Server[] = [];

  async function startAppServer(envVars: Record<string, string>): Promise<{ server: Server; baseUrl: string }> {
    // Backup and set env variables
    const originalEnv: Record<string, string | undefined> = {};
    for (const key of Object.keys(envVars)) {
      originalEnv[key] = process.env[key];
      process.env[key] = envVars[key];
    }

    const app = await createApp();
    const server = app.server();
    servers.push(server);

    const baseUrl = await new Promise<string>((resolve) => {
      server.listen(0, () => {
        const address = server.address();
        if (address && typeof address !== 'string') {
          resolve(`http://localhost:${address.port}`);
        }
      });
    });

    // Restore env variables
    for (const key of Object.keys(envVars)) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }

    return { server, baseUrl };
  }

  async function testFetch(url: string, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    headers.set('Connection', 'close');
    return fetch(url, { ...init, headers });
  }

  afterEach(async () => {
    for (const server of servers) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    servers = [];
  });

  it('should return the correct Access-Control-Allow-Origin header matching the configured single CORS_ORIGIN', async () => {
    const { baseUrl } = await startAppServer({ CORS_ORIGIN: 'http://localhost:3000' });
    const res = await testFetch(`${baseUrl}/health`, {
      headers: {
        'Origin': 'http://localhost:3000'
      }
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });

  it('should return * when CORS_ORIGIN is not configured', async () => {
    const { baseUrl } = await startAppServer({});
    const res = await testFetch(`${baseUrl}/health`, {
      headers: {
        'Origin': 'http://localhost:3000'
      }
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('should allow request when Origin matches one of multiple configured CORS_ORIGINs', async () => {
    const { baseUrl } = await startAppServer({ CORS_ORIGIN: 'http://localhost:3000,http://localhost:3001' });
    
    // First, try matching the first origin
    const res1 = await testFetch(`${baseUrl}/health`, {
      headers: {
        'Origin': 'http://localhost:3000'
      }
    });
    expect(res1.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');

    // Second, try matching the second origin
    const res2 = await testFetch(`${baseUrl}/health`, {
      headers: {
        'Origin': 'http://localhost:3001'
      }
    });
    expect(res2.headers.get('access-control-allow-origin')).toBe('http://localhost:3001');
  });

  it('should not allow/match when Origin does not match any of the configured CORS_ORIGINs', async () => {
    const { baseUrl } = await startAppServer({ CORS_ORIGIN: 'http://localhost:3000,http://localhost:3001' });
    const res = await testFetch(`${baseUrl}/health`, {
      headers: {
        'Origin': 'http://localhost:3002'
      }
    });
    // In CORS, if origin doesn't match, access-control-allow-origin should either be absent or not equal to the request origin
    const allowedOrigin = res.headers.get('access-control-allow-origin');
    expect(allowedOrigin).not.toBe('http://localhost:3002');
  });

  it('should handle preflight OPTIONS requests successfully', async () => {
    const { baseUrl } = await startAppServer({ CORS_ORIGIN: 'http://localhost:3000' });
    const res = await testFetch(`${baseUrl}/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET'
      }
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });

  it('should allow request when Origin matches wildcard pattern in CORS_ORIGIN', async () => {
    const { baseUrl } = await startAppServer({ CORS_ORIGIN: 'https://*.amazon.com,http://localhost:3000' });

    // Try matching a subdomain of amazon.com
    const res1 = await testFetch(`${baseUrl}/health`, {
      headers: {
        'Origin': 'https://sub.amazon.com'
      }
    });
    expect(res1.headers.get('access-control-allow-origin')).toBe('https://sub.amazon.com');

    // Try matching another subdomain of amazon.com
    const res2 = await testFetch(`${baseUrl}/health`, {
      headers: {
        'Origin': 'https://another.sub.amazon.com'
      }
    });
    expect(res2.headers.get('access-control-allow-origin')).toBe('https://another.sub.amazon.com');
  });

  it('should not allow request when Origin matches wildcard pattern suffix but is a different domain', async () => {
    const { baseUrl } = await startAppServer({ CORS_ORIGIN: 'https://*.amazon.com' });

    // Try a malicious domain that ends with amazon.com but is different
    const res = await testFetch(`${baseUrl}/health`, {
      headers: {
        'Origin': 'https://amazon.com.attacker.com'
      }
    });
    expect(res.headers.get('access-control-allow-origin')).not.toBe('https://amazon.com.attacker.com');
  });
});
