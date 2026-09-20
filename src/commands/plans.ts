import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';

export default defineCommand({
  meta: {
    name: 'plans',
    description: 'Lists all plans',
  },
  args: {},
  async run({ args }) {
    p.intro(pc.blue('DevOrchestrator Plans'));
    try {
      p.log.info('1  | Init  | Done   | Today');
    } catch (e: any) {
      p.log.error(`Failed: ${e.message}`);
    }
    p.outro('Done');
  }
});
