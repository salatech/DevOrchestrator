import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { formatPlan } from '../ui/display.js';
import { openWorkspace, requireInitialized } from '../runtime.js';
import { fail } from './helpers.js';

export default defineCommand({
  meta: {
    name: 'show',
    description: 'Show a plan in full',
  },
  args: {
    id: {
      type: 'positional',
      description: 'Plan ID (e.g. PLAN-001)',
      required: true,
    },
  },
  async run({ args }) {
    try {
      p.intro(pc.bgCyan(pc.black(' DevOrchestrator ')));
      const runtime = await openWorkspace();
      await requireInitialized(runtime);
      const plan = await runtime.planManager.loadPlan(String(args.id));
      console.log('\n' + formatPlan(plan));
      p.outro('Done');
    } catch (error) {
      fail(error);
    }
  },
});
