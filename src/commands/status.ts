import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';

export default defineCommand({
  meta: { name: 'status', description: 'Shows project status' },
  args: {},
  async run({ args }) {
    p.intro(pc.blue(`DevOrchestrator Status`));
    p.outro('Done');
  }
});
