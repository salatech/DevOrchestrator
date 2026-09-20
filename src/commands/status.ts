import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { formatStatus } from '../ui/display.js';
import { openWorkspace, requireInitialized } from '../runtime.js';
import { fail } from './helpers.js';
import { PlanStatus } from '../plans/types.js';
import { ExecutionTracer } from '../state/tracer.js';

const ACTIVE_STATUSES = new Set([
  PlanStatus.Draft,
  PlanStatus.AwaitingApproval,
  PlanStatus.Approved,
  PlanStatus.Executing,
  PlanStatus.Validating,
  PlanStatus.Reviewing,
]);

export default defineCommand({
  meta: {
    name: 'status',
    description: 'Show project, git, and active-plan status',
  },
  args: {},
  async run() {
    try {
      p.intro(pc.bgCyan(pc.black(' DevOrchestrator ')));
      const runtime = await openWorkspace();
      await requireInitialized(runtime);

      const info = await runtime.workspace.inspect();
      const git = await runtime.workspace.getGitState().catch(() => null);
      const pkg = await runtime.workspace.getPackageInfo();
      const plans = await runtime.planManager.listPlans();
      const active = plans.filter((plan) => ACTIVE_STATUSES.has(plan.status as PlanStatus));
      const tracer = new ExecutionTracer(runtime.root);
      const runs = await tracer.list();
      const lastRun = runs.sort((a, b) => a.startedAt.localeCompare(b.startedAt)).at(-1);

      const projectName = pkg?.name || info.root;
      const stack = [
        info.projectType,
        info.languages.join(', ') || 'unknown',
        info.frameworks.join(', ') || 'none',
      ].join(' / ');

      console.log(`${pc.bold('Project:')}    ${projectName} (${stack})`);
      console.log(`${pc.bold('Root:')}       ${info.root}`);
      console.log(`${pc.bold('Branch:')}     ${git?.branch || '(no git)'}`);
      if (git) {
        console.log(
          `${pc.bold('Git:')}        ${git.modifiedFiles.length} modified, ${git.stagedFiles.length} staged, ${git.untrackedFiles.length} untracked`,
        );
      }
      console.log(
        `${pc.bold('Active Plan:')} ${
          active[0]
            ? `${active[0].id} (${formatStatus(active[0].status as PlanStatus)})`
            : pc.dim('none')
        }`,
      );
      console.log(
        `${pc.bold('Planner:')}    ${runtime.config.planner.model} (${runtime.config.planner.provider})`,
      );
      console.log(`${pc.bold('Executor:')}   ${runtime.config.executor.agent}`);
      console.log(
        `${pc.bold('Reviewer:')}   ${runtime.config.reviewer.model} (${runtime.config.reviewer.provider})`,
      );
      console.log(
        `${pc.bold('Last Run:')}    ${lastRun ? `${lastRun.id} (${lastRun.status})` : pc.dim('none')}`,
      );

      p.outro('Done');
    } catch (error) {
      fail(error);
    }
  },
});
