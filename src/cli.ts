import { defineCommand, runMain } from 'citty';

const main = defineCommand({
  meta: {
    name: 'devai',
    description: 'AI Developer Orchestrator — separates software planning from execution',
    version: '0.1.0',
  },
  subCommands: {
    init: () => import('./commands/init.js').then((m) => m.default),
    plan: () => import('./commands/plan.js').then((m) => m.default),
    plans: () => import('./commands/plans.js').then((m) => m.default),
    show: () => import('./commands/show.js').then((m) => m.default),
    approve: () => import('./commands/approve.js').then((m) => m.default),
    execute: () => import('./commands/execute.js').then((m) => m.default),
    review: () => import('./commands/review.js').then((m) => m.default),
    run: () => import('./commands/run.js').then((m) => m.default),
    status: () => import('./commands/status.js').then((m) => m.default),
    context: () => import('./commands/context.js').then((m) => m.default),
    diff: () => import('./commands/diff.js').then((m) => m.default),
    doctor: () => import('./commands/doctor.js').then((m) => m.default),
  },
});

runMain(main);
