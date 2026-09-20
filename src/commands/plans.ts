import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import Table from 'cli-table3';
import { formatStatus } from '../ui/display.js';
import { openWorkspace, requireInitialized } from '../runtime.js';
import { fail } from './helpers.js';
import { PlanStatus } from '../plans/types.js';

export default defineCommand({
  meta: {
    name: 'plans',
    description: 'List all plans',
  },
  args: {
    status: {
      type: 'string',
      description: 'Filter by status (draft, approved, completed, ...)',
    },
  },
  async run({ args }) {
    try {
      p.intro(pc.bgCyan(pc.black(' DevOrchestrator ')));
      const runtime = await openWorkspace();
      await requireInitialized(runtime);

      let plans = await runtime.planManager.listPlans();
      if (args.status) {
        const wanted = String(args.status);
        plans = plans.filter(
          (plan) => plan.status === wanted || plan.status === wanted.replace('-', '_'),
        );
      }

      if (plans.length === 0) {
        p.log.info('No plans found. Create one with `devorch plan "your request"`.');
        p.outro('Done');
        return;
      }

      const table = new Table({
        head: ['ID', 'Title', 'Status', 'Updated'],
        style: { head: ['cyan'] },
        wordWrap: true,
        colWidths: [12, 42, 20, 22],
      });

      for (const plan of plans) {
        table.push([
          plan.id,
          plan.title,
          formatStatus(plan.status as PlanStatus),
          plan.updated || plan.created,
        ]);
      }

      console.log(table.toString());
      p.outro('Done');
    } catch (error) {
      fail(error);
    }
  },
});
