import type { WorkspaceSnapshot } from '../workspace/types.js';
import type { SnapshotDiff } from './types.js';
import type { WorkspaceManager } from '../workspace/manager.js';

export class SnapshotManager {
  async capture(workspace: WorkspaceManager): Promise<WorkspaceSnapshot> {
    return workspace.snapshot();
  }

  compare(before: WorkspaceSnapshot, after: WorkspaceSnapshot): SnapshotDiff {
    const beforeModified = new Set(before.modifiedFiles);
    const beforeUntracked = new Set(before.untrackedFiles);
    const beforeDeleted = new Set(before.deletedFiles);

    return {
      filesAdded: after.untrackedFiles.filter((file) => !beforeUntracked.has(file)),
      filesRemoved: after.deletedFiles.filter((file) => !beforeDeleted.has(file)),
      filesModified: after.modifiedFiles.filter((file) => !beforeModified.has(file)),
      totalModifiedBefore: before.modifiedFiles.length,
      totalModifiedAfter: after.modifiedFiles.length,
    };
  }
}
