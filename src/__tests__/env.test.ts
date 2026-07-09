import { env } from '../utils/env';

describe('Env Utility', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset process.env before each test
    process.env = { ...originalEnv };
    delete process.env.PORT;
    delete process.env.NODE_ENV; // Will fallback to test logic dynamically
    delete process.env.DATABASE_PATH;
    delete process.env.SCRIPTS_DIR;
    delete process.env.LOG_LEVEL;
    delete process.env.CORS_ORIGIN;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return default values when environment variables are not set', () => {
    expect(env.PORT).toBe(3000);
    expect(env.DATABASE_PATH).toBe('database.sqlite');
    expect(env.SCRIPTS_DIR).toBe('./host-scripts');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.CORS_ORIGIN).toBe('*');
  });

  it('should return custom values when environment variables are set', () => {
    process.env.PORT = '8080';
    process.env.NODE_ENV = 'production'; // This caches it!
    process.env.DATABASE_PATH = 'prod.sqlite';
    process.env.SCRIPTS_DIR = './scripts';
    process.env.LOG_LEVEL = 'error';
    process.env.CORS_ORIGIN = 'https://example.com,https://api.example.com';

    expect(env.PORT).toBe(8080); // Coerced to number
    expect(env.NODE_ENV).toBe('production');
    expect(env.DATABASE_PATH).toBe('prod.sqlite');
    expect(env.SCRIPTS_DIR).toBe('./scripts');
    expect(env.LOG_LEVEL).toBe('error');
    expect(env.CORS_ORIGIN).toBe('https://example.com,https://api.example.com');
  });

  it('should throw an error when a variable violates schema validation', () => {
    process.env.PORT = 'invalid-number';
    expect(() => {
      // Accessing a property triggers the validation
      void env.PORT;
    }).toThrow();
  });

  it('should reflect process.env changes dynamically', () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '5000';
    expect(env.PORT).toBe(5000);

    process.env.PORT = '6000';
    expect(env.PORT).toBe(6000);
  });
});



