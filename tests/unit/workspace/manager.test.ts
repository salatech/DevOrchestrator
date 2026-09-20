import { describe, it, expect, vi } from 'vitest';
import * as path from 'node:path';
import { WorkspaceManager } from '../../../src/workspace/manager.js';
import * as filesystem from '../../../src/workspace/filesystem.js';

describe('workspace/manager', () => {
  describe('findProjectRoot', () => {
    it('returns the dir if package.json exists', async () => {
      vi.spyOn(filesystem, 'fileExists').mockImplementation(async (p: string) => p.endsWith('package.json'));
      vi.spyOn(filesystem, 'pathExists').mockImplementation(async (p: string) => false);
      
      const result = await WorkspaceManager.findProjectRoot('/mock/dir/nested');
      expect(result).toBe(path.resolve('/mock/dir/nested'));
    });
    
    it('traverses up until it finds a marker', async () => {
      vi.spyOn(filesystem, 'fileExists').mockImplementation(async (p: string) => p === path.resolve('/mock/dir/package.json'));
      vi.spyOn(filesystem, 'pathExists').mockImplementation(async (p: string) => false);
      
      const result = await WorkspaceManager.findProjectRoot('/mock/dir/nested/deep');
      expect(result).toBe(path.resolve('/mock/dir'));
    });
  });
});
