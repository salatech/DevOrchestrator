import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import { PlanStatus } from '../plans/types.js';
import { formatPlan } from '../ui/display.js';
import { promptPlanApproval, promptConfirm, promptText, showWarning } from '../ui/prompts.js';
import { createAgentRuntime } from '../runtime.js';
import { fail, splitList } from './helpers.js';

export default defineCommand({
  meta: {
    name: 'plan',
    description: 'Create an implementation plan from a natural-language request',
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
      description: 'Approve the generated plan immediately',
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

      let action: 'approve' | 'edit' | 'regenerate' | 'reject' = args.yes
        ? 'approve'
        : await promptPlanApproval();

      if (action === 'edit') {
        const notes = await promptText(
          'What should change in the plan?',
          'Be more specific about tests',
        );
        await runtime.planManager.transitionStatus(plan.id, PlanStatus.Cancelled);
        runtime.progress.start();
        const revised = await runtime.orchestrator.plan({
          request: `${args.request}\n\nAdditional instructions: ${notes}`,
          includeFiles: splitList(args.include),
        });
        runtime.progress.stop();
        console.log('\n' + formatPlan(revised) + '\n');
        action = args.yes ? 'approve' : await promptPlanApproval();
        if (action === 'approve') {
          await runtime.planManager.transitionStatus(revised.id, PlanStatus.Approved);
          p.log.success(`Approved ${revised.id}`);
          const shouldExecute = args.yes || (await promptConfirm('Execute this plan now?'));
          if (shouldExecute) {
            runtime.progress.start();
            const report = await runtime.orchestrator.execute({ planId: revised.id });
            runtime.progress.stop();
            const { formatReport } = await import('../ui/display.js');
            console.log('\n' + formatReport(report));
          }
        } else if (action === 'reject') {
          await runtime.planManager.transitionStatus(revised.id, PlanStatus.Cancelled);
          p.log.warn(`Cancelled ${revised.id}`);
        }
      } else if (action === 'regenerate') {
        await runtime.planManager.transitionStatus(plan.id, PlanStatus.Cancelled);
        runtime.progress.start();
        const regenerated = await runtime.orchestrator.plan({
          request: String(args.request),
          includeFiles: splitList(args.include),
        });
        runtime.progress.stop();
        console.log('\n' + formatPlan(regenerated) + '\n');
        p.log.info(`Generated ${regenerated.id} (previous plan cancelled)`);
      } else if (action === 'reject') {
        await runtime.planManager.transitionStatus(plan.id, PlanStatus.Cancelled);
        p.log.warn(`Cancelled ${plan.id}`);
      } else {
        await runtime.planManager.transitionStatus(plan.id, PlanStatus.Approved);
        p.log.success(`Approved ${plan.id}`);
        const shouldExecute = args.yes ? false : await promptConfirm('Execute this plan now?');
        if (shouldExecute) {
          runtime.progress.start();
          const report = await runtime.orchestrator.execute({ planId: plan.id });
          runtime.progress.stop();
          const { formatReport } = await import('../ui/display.js');
          console.log('\n' + formatReport(report));
        } else {
          p.log.info(`Next: \`devorch execute ${plan.id}\``);
        }
      }

      p.outro('Done');
    } catch (error) {
      fail(error);
    }
  },
});
