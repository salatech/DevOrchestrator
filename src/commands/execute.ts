import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import { formatPlan, formatReport } from '../ui/display.js';
import { promptConfirm, showWarning } from '../ui/prompts.js';
import { createAgentRuntime } from '../runtime.js';
import { fail } from './helpers.js';

export default defineCommand({
  meta: {
    name: 'execute',
    description: 'Execute an approved plan',
  },
  args: {
    id: {
      type: 'positional',
      description: 'Plan ID (e.g. PLAN-001)',
      required: true,
    },
    yes: {
      type: 'boolean',
      alias: 'y',
      description: 'Skip confirmation',
      default: false,
    },
  },
  async run({ args }) {
    try {
      const runtime = await createAgentRuntime();
      for (const warning of runtime.warnings) showWarning(warning);

      const plan = await runtime.planManager.loadPlan(String(args.id));
      console.log('\n' + formatPlan(plan) + '\n');

      const confirmed =
        args.yes || (await promptConfirm(`Execute ${plan.id}? This will modify the workspace.`));
      if (!confirmed) {
        p.log.warn('Execution cancelled.');
        p.outro('Done');
        return;
      }

      runtime.progress.start();
      try {
        const report = await runtime.orchestrator.execute({ planId: plan.id });
        runtime.progress.stop();
        console.log('\n' + formatReport(report));
      } catch (error) {
        runtime.progress.stop();
        throw error;
      }
      p.outro('Done');
    } catch (error) {
      fail(error);
    }
  },
});
