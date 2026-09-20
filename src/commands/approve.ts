import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';

export default defineCommand({
  meta: { name: 'approve', description: 'Approves a plan' },
  args: { id: { type: 'positional', description: 'Plan ID', required: true } },
  async run({ args }) {
    p.intro(pc.blue(`DevOrchestrator Approve Plan ${args.id}`));
    p.outro('Done');
  }
});
