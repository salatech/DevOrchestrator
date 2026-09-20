import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { formatDiff } from '../ui/display.js';
import { openWorkspace, requireInitialized } from '../runtime.js';
import { fail } from './helpers.js';

export default defineCommand({
  meta: {
    name: 'diff',
    description: 'Show the current git diff',
  },
  args: {
    staged: {
      type: 'boolean',
      description: 'Show staged changes only',
      default: false,
    },
  },
  async run({ args }) {
    try {
      p.intro(pc.bgCyan(pc.black(' DevOrchestrator ')));
      const runtime = await openWorkspace();
      await requireInitialized(runtime);

      const diff = await runtime.workspace.getDiff(Boolean(args.staged));
      const stats = await runtime.workspace.getDiffStats();
      console.log(
        pc.dim(`${stats.filesChanged} files, +${stats.insertions} / -${stats.deletions}`),
      );
      console.log('\n' + formatDiff(diff));
      p.outro('Done');
    } catch (error) {
      fail(error);
    }
  },
});
