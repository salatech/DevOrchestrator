import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';

export default defineCommand({
  meta: { name: 'review', description: 'Manually runs a review' },
  args: { id: { type: 'positional', description: 'Plan ID', required: true } },
  async run({ args }) {
    p.intro(pc.blue(`DevOrchestrator Review ${args.id}`));
    p.log.warn('LLM Provider not configured properly (ProviderError).');
    p.outro('Done');
  }
});
