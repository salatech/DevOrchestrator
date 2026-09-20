import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { enforceSafePath } from '../../../src/workspace/filesystem.js';
import { SecurityError } from '../../../src/errors/index.js';

describe('workspace/filesystem', () => {
  describe('enforceSafePath', () => {
    const root = '/mock/workspace';

    it('allows paths within the workspace', () => {
      const safe1 = enforceSafePath(root, 'src/index.ts');
      expect(safe1).toBe(path.resolve('/mock/workspace/src/index.ts'));

      const safe2 = enforceSafePath(root, './package.json');
      expect(safe2).toBe(path.resolve('/mock/workspace/package.json'));
    });

    it('blocks directory traversal attacks', () => {
      expect(() => enforceSafePath(root, '../secrets.txt')).toThrow(SecurityError);
      expect(() => enforceSafePath(root, '../../etc/passwd')).toThrow(SecurityError);
    });

    it('blocks absolute paths outside the workspace', () => {
      expect(() => enforceSafePath(root, '/etc/passwd')).toThrow(SecurityError);
      expect(() => enforceSafePath(root, '/mock/workspace2/file.txt')).toThrow(SecurityError);
    });
    
    it('allows the root itself', () => {
      expect(enforceSafePath(root, '')).toBe(path.resolve('/mock/workspace'));
      expect(enforceSafePath(root, '.')).toBe(path.resolve('/mock/workspace'));
    });
  });
});
