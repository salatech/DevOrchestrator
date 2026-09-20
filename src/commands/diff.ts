import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';

export default defineCommand({
  meta: { name: 'diff', description: 'Shows current git diff' },
  args: {},
  async run({ args }) {
    p.intro(pc.blue(`DevOrchestrator Diff`));
    p.outro('Done');
  }
});
