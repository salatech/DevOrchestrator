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
    fileFingerprints: {},
    timestamp: '2026-09-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('state/snapshot', () => {
  const manager = new SnapshotManager();

  it('detects newly modified, created, and deleted files from fingerprints', () => {
    const before = snapshot({
      fileFingerprints: {
        'src/old.ts': '10:a',
        'scratch.ts': '1:b',
      },
    });
    const after = snapshot({
      fileFingerprints: {
        'src/old.ts': '10:a',
        'src/new.ts': '20:c',
        'scratch.ts': '1:b',
        'created.ts': '5:d',
      },
    });

    const diff = manager.compare(before, after);
    expect(diff.filesModified).toEqual([]);
    expect(diff.filesAdded.sort()).toEqual(['created.ts', 'src/new.ts']);
    expect(diff.filesRemoved).toEqual([]);
  });

  it('falls back to git lists when fingerprints are absent', () => {
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
