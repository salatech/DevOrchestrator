import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import { formatPlan, formatReport } from '../ui/display.js';
import { promptPlanApproval, promptConfirm, showWarning } from '../ui/prompts.js';
import { PlanStatus } from '../plans/types.js';
import { createAgentRuntime } from '../runtime.js';
import { fail, splitList } from './helpers.js';

export default defineCommand({
  meta: {
    name: 'run',
    description: 'Plan, approve, execute, and review in one workflow',
  },
  args: {
    request: {
      type: 'positional',
      description: 'What you want to implement',
      required: true,
    },
    include: {
      type: 'string',
      description: 'Comma-separated extra files to include in context',
    },
    yes: {
      type: 'boolean',
      alias: 'y',
      description: 'Skip approval and execute immediately',
      default: false,
    },
  },
  async run({ args }) {
    try {
      const runtime = await createAgentRuntime();
      for (const warning of runtime.warnings) showWarning(warning);
      runtime.progress.start();

      const plan = await runtime.orchestrator.plan({
        request: String(args.request),
        includeFiles: splitList(args.include),
      });

      runtime.progress.stop();
      console.log('\n' + formatPlan(plan) + '\n');

      if (!args.yes) {
        const action = await promptPlanApproval();
        if (action !== 'approve') {
          await runtime.planManager.transitionStatus(plan.id, PlanStatus.Cancelled);
          p.log.warn(`Cancelled ${plan.id}`);
          p.outro('Done');
          return;
        }
        const confirmed = await promptConfirm(`Execute ${plan.id} now?`);
        if (!confirmed) {
          await runtime.planManager.transitionStatus(plan.id, PlanStatus.Approved);
          p.log.info(`Approved ${plan.id}. Run \`devorch execute ${plan.id}\` when ready.`);
          p.outro('Done');
          return;
        }
      }

      await runtime.planManager.transitionStatus(plan.id, PlanStatus.Approved);
      runtime.progress.start();
      const report = await runtime.orchestrator.execute({ planId: plan.id });
      runtime.progress.stop();
      console.log('\n' + formatReport(report));
      p.outro('Done');
    } catch (error) {
      fail(error);
    }
  },
});
