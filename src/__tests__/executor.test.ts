import path from 'path';
import { getSafeScriptPath } from '../services/executor.service';

describe('Executor Service - getSafeScriptPath', () => {
  it('should throw an error if script path attempts directory traversal', () => {
    expect(() => {
      getSafeScriptPath('../../../etc/passwd');
    }).toThrow('Acesso negado: directory traversal detectado.');

    expect(() => {
      getSafeScriptPath('/etc/passwd');
    }).toThrow('Acesso negado: directory traversal detectado.');
  });

  it('should throw an error for non-existent scripts', () => {
    expect(() => {
      getSafeScriptPath('non-existent-script-xyz.sh');
    }).toThrow('Script não encontrado');
  });

  it('should resolve and return path for existing safe scripts', () => {
    // test-script.sh was created in host-scripts/
    const safePath = getSafeScriptPath('test-script.sh');
    const expectedPath = path.resolve(process.cwd(), './host-scripts/test-script.sh');
    expect(safePath).toBe(expectedPath);
  });
});
