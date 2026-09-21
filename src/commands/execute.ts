import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import { PlanStatus } from '../plans/types.js';
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

      let plan = await runtime.planManager.loadPlan(String(args.id));
      console.log('\n' + formatPlan(plan) + '\n');

      const rerun = plan.status === PlanStatus.Completed || plan.status === PlanStatus.Failed;
      const confirmed =
        args.yes ||
        (await promptConfirm(
          rerun
            ? `${plan.id} is ${plan.status}. Run it again? This will modify the workspace.`
            : `Execute ${plan.id}? This will modify the workspace.`,
        ));
      if (!confirmed) {
        p.log.warn('Execution cancelled.');
        p.outro('Done');
        return;
      }

      if (rerun) {
        plan = await runtime.planManager.transitionStatus(plan.id, PlanStatus.Approved);
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
