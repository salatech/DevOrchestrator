import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import { PlanStatus } from '../plans/types.js';
import { formatPlan } from '../ui/display.js';
import { promptConfirm } from '../ui/prompts.js';
import { openWorkspace, requireInitialized } from '../runtime.js';
import { fail } from './helpers.js';

export default defineCommand({
  meta: {
    name: 'approve',
    description: 'Approve a plan so it can be executed',
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
      p.intro('DevOrchestrator');
      const runtime = await openWorkspace();
      await requireInitialized(runtime);

      const plan = await runtime.planManager.loadPlan(String(args.id));
      console.log('\n' + formatPlan(plan) + '\n');

      if (plan.status === PlanStatus.Approved) {
        p.log.info(`${plan.id} is already approved.`);
        p.outro('Done');
        return;
      }

      const confirmed = args.yes || (await promptConfirm(`Approve ${plan.id}?`));
      if (!confirmed) {
        p.log.warn('Approval cancelled.');
        p.outro('Done');
        return;
      }

      if (plan.status === PlanStatus.Draft) {
        await runtime.planManager.transitionStatus(plan.id, PlanStatus.AwaitingApproval);
      }

      await runtime.planManager.transitionStatus(plan.id, PlanStatus.Approved);
      p.log.success(`Approved ${plan.id}`);
      p.log.info(`Next: \`devorch execute ${plan.id}\``);
      p.outro('Done');
    } catch (error) {
      fail(error);
    }
  },
});
