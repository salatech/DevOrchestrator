import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';

export default defineCommand({
  meta: {
    name: 'show',
    description: 'Shows a specific plan',
  },
  args: {
    id: { type: 'positional', description: 'Plan ID', required: true }
  },
  async run({ args }) {
    p.intro(pc.blue(`DevOrchestrator Show Plan ${args.id}`));
    p.outro('Done');
  }
});
