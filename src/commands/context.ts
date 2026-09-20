import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';

export default defineCommand({
  meta: { name: 'context', description: 'Shows context' },
  args: { request: { type: 'positional', required: false, default: 'general' } },
  async run({ args }) {
    p.intro(pc.blue(`DevOrchestrator Context`));
    p.outro('Done');
  }
});
