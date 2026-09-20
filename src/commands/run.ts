import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';

export default defineCommand({
  meta: { name: 'run', description: 'Run full workflow' },
  args: { request: { type: 'positional', description: 'Request', required: true } },
  async run({ args }) {
    p.intro(pc.blue(`DevOrchestrator Run`));
    p.log.warn('LLM Provider not configured properly (ProviderError).');
    p.outro('Done');
  }
});
