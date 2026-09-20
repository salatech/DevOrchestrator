#!/bin/bash
rm -rf .git
git init
git branch -M main
git remote add origin https://github.com/salatech/DevOrchestrator.git

# Helper function
commit() {
  local msg="$1"
  shift
  for file in "$@"; do
    if [ -f "$file" ]; then
      git add "$file"
    fi
  done
  git commit -m "$msg"
}

commit "chore: initial project configuration" package.json tsconfig.json tsup.config.ts vitest.config.ts .prettierrc .gitignore pnpm-workspace.yaml pnpm-lock.yaml
commit "feat(core): implement core domain types and error hierarchy" src/errors/index.ts src/core/types.ts
commit "feat(workspace): define workspace layer types" src/workspace/types.ts
commit "feat(workspace): implement secure filesystem abstraction" src/workspace/filesystem.ts
commit "feat(workspace): implement local git integration" src/workspace/git.ts
commit "feat(workspace): implement stack and framework detector" src/workspace/detector.ts
commit "feat(workspace): implement workspace manager facade" src/workspace/manager.ts src/workspace/index.ts
commit "feat(config): implement configuration schema and loader" src/config/defaults.ts src/config/loader.ts src/config/schema.ts src/config/types.ts src/config/index.ts
commit "feat(context): implement context collector" src/context/types.ts src/context/collector.ts
commit "feat(context): implement context selector and engine" src/context/selector.ts src/context/engine.ts src/context/index.ts
commit "feat(skills): implement skill discovery and loading" src/skills/discovery.ts src/skills/loader.ts src/skills/types.ts src/skills/index.ts
commit "feat(plans): implement plan parser and types" src/plans/types.ts src/plans/parser.ts
commit "feat(plans): implement plan state machine and serializer" src/plans/state-machine.ts src/plans/serializer.ts
commit "feat(plans): implement plan validation and manager" src/plans/validator.ts src/plans/manager.ts src/plans/index.ts
commit "feat(security): implement command security policies" src/security/types.ts src/security/policy.ts src/security/defaults.ts
commit "feat(security): implement secure command executor" src/security/executor.ts src/security/index.ts
commit "feat(providers): implement LLM provider orchestrator" src/providers/orchestrator.ts src/providers/types.ts src/providers/usage-tracker.ts src/providers/index.ts
commit "feat(agents): define agent interfaces" src/agents/types.ts src/agents/interfaces.ts src/agents/index.ts
commit "feat(agents): implement planner, reviewer, and cli executor" src/agents/cli-executor.ts src/agents/llm-planner.ts src/agents/llm-reviewer.ts
commit "feat(state): implement workspace snapshots and execution tracing" src/state/snapshot.ts src/state/tracer.ts src/state/types.ts src/state/index.ts
commit "feat(ui): implement terminal UI components" src/ui/display.ts src/ui/progress.ts src/ui/prompts.ts src/ui/index.ts
commit "feat(core): implement core orchestration loop" src/core/orchestrator.ts src/core/index.ts
commit "feat(cli): implement CLI entrypoint" src/cli.ts bin/devai.js
commit "feat(cli): add init and status commands" src/commands/init.ts src/commands/status.ts
commit "feat(cli): add plan and show commands" src/commands/plan.ts src/commands/show.ts src/commands/plans.ts
commit "feat(cli): add execute, review, and approve commands" src/commands/execute.ts src/commands/review.ts src/commands/approve.ts
commit "feat(cli): add context, diff, doctor, and run utility commands" src/commands/context.ts src/commands/diff.ts src/commands/doctor.ts src/commands/run.ts
commit "docs(ai): add initial AI project documentation" .ai/PROJECT.md .ai/ARCHITECTURE.md .ai/CONVENTIONS.md .ai/plans/000-mvp.md .ai/.devai.json
commit "test: add configuration, context, and security unit tests" tests/unit/config/loader.test.ts tests/unit/context/selector.test.ts tests/unit/security/policy.test.ts
commit "test: add plan parsing and skills unit tests" tests/unit/plans/parser.test.ts tests/unit/plans/serializer.test.ts tests/unit/plans/state-machine.test.ts tests/unit/plans/validator.test.ts tests/unit/skills/discovery.test.ts
commit "test: add workspace security and detection tests" tests/unit/workspace/filesystem.test.ts tests/unit/workspace/manager.test.ts
commit "ci: add GitHub Actions workflow and deployment guides" .github/workflows/ci.yml DEPLOYMENT.md SECURITY.md README.md

# Catch any straggler files that weren't explicitly listed above
untracked=$(git ls-files --others --exclude-standard)
if [ -n "$untracked" ]; then
  git add $untracked
  git commit -m "chore: add remaining miscellaneous files"
fi
