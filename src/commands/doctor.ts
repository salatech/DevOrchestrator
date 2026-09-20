import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';

export default defineCommand({
  meta: { name: 'doctor', description: 'Runs environment checks' },
  args: {},
  async run({ args }) {
    p.intro(pc.blue(`DevOrchestrator Doctor`));
    p.outro('Done');
  }
});
