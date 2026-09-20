import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import { formatReview, formatPlan } from '../ui/display.js';
import { showWarning } from '../ui/prompts.js';
import { createAgentRuntime } from '../runtime.js';
import { fail } from './helpers.js';

export default defineCommand({
  meta: {
    name: 'review',
    description: 'Review the current workspace diff against a plan',
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
      const runtime = await createAgentRuntime();
      for (const warning of runtime.warnings) showWarning(warning);

      const plan = await runtime.planManager.loadPlan(String(args.id));
      runtime.progress.start();
      const review = await runtime.orchestrator.review(plan.id);
      runtime.progress.stop();

      console.log('\n' + formatPlan(plan) + '\n');
      console.log(formatReview(review));
      p.outro('Done');
    } catch (error) {
      fail(error);
    }
  },
});
