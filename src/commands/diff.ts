import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { formatDiff } from '../ui/display.js';
import { openWorkspace, requireInitialized } from '../runtime.js';
import { fail } from './helpers.js';

export default defineCommand({
  meta: {
    name: 'diff',
    description: 'Show local workspace changes (prefers files on disk; git diff if available)',
  },
  args: {
    staged: {
      type: 'boolean',
      description: 'Show staged git changes only (git projects)',
      default: false,
    },
  },
  async run({ args }) {
    try {
      p.intro(pc.bgCyan(pc.black(' DevOrchestrator ')));
      const runtime = await openWorkspace();
      await requireInitialized(runtime);

      if (args.staged) {
        const diff = await runtime.workspace.getDiff(true);
        const stats = await runtime.workspace.getDiffStats();
        console.log(
          pc.dim(`${stats.filesChanged} files, +${stats.insertions} / -${stats.deletions}`),
        );
        console.log('\n' + formatDiff(diff));
      } else {
        const changeView = await runtime.workspace.buildChangeMaterial();
        console.log(pc.dim(`source: ${changeView.source}`));
        console.log('\n' + formatDiff(changeView.material));
      }
      p.outro('Done');
    } catch (error) {
      fail(error);
    }
  },
});
