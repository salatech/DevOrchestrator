import { describe, it, expect } from 'vitest';
import { SnapshotManager } from '../../../src/state/snapshot.js';
import type { WorkspaceSnapshot } from '../../../src/workspace/types.js';

function snapshot(overrides: Partial<WorkspaceSnapshot> = {}): WorkspaceSnapshot {
  return {
    branch: 'main',
    head: 'abc',
    modifiedFiles: [],
    untrackedFiles: [],
    deletedFiles: [],
    timestamp: '2026-09-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('state/snapshot', () => {
  const manager = new SnapshotManager();

  it('detects newly modified, created, and deleted files', () => {
    const before = snapshot({
      modifiedFiles: ['src/old.ts'],
      untrackedFiles: ['scratch.ts'],
      deletedFiles: [],
    });
    const after = snapshot({
      modifiedFiles: ['src/old.ts', 'src/new.ts'],
      untrackedFiles: ['scratch.ts', 'created.ts'],
      deletedFiles: ['gone.ts'],
    });

    const diff = manager.compare(before, after);
    expect(diff.filesModified).toEqual(['src/new.ts']);
    expect(diff.filesAdded).toEqual(['created.ts']);
    expect(diff.filesRemoved).toEqual(['gone.ts']);
    expect(diff.totalModifiedAfter).toBe(2);
  });
});
