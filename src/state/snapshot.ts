import type { WorkspaceSnapshot } from '../workspace/types.js';
import type { SnapshotDiff } from './types.js';
import type { WorkspaceManager } from '../workspace/manager.js';

export class SnapshotManager {
  async capture(workspace: WorkspaceManager): Promise<WorkspaceSnapshot> {
    return workspace.snapshot();
  }

  compare(before: WorkspaceSnapshot, after: WorkspaceSnapshot): SnapshotDiff {
    const beforePrints = before.fileFingerprints ?? {};
    const afterPrints = after.fileFingerprints ?? {};
    const beforeKeys = new Set(Object.keys(beforePrints));
    const afterKeys = new Set(Object.keys(afterPrints));

    if (beforeKeys.size > 0 || afterKeys.size > 0) {
      const filesAdded = [...afterKeys].filter((file) => !beforeKeys.has(file));
      const filesRemoved = [...beforeKeys].filter((file) => !afterKeys.has(file));
      const filesModified = [...afterKeys].filter(
        (file) => beforeKeys.has(file) && beforePrints[file] !== afterPrints[file],
      );

      return {
        filesAdded,
        filesRemoved,
        filesModified,
        totalModifiedBefore: Object.keys(beforePrints).length,
        totalModifiedAfter: Object.keys(afterPrints).length,
      };
    }

    // Legacy/git-only snapshots (no fingerprints)
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
