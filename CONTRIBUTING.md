# Contributing

DevOrchestrator is a **local-first** CLI. Changes should preserve that: the workspace stays on the machine, cloud is optional, and secrets never belong in git or model context.

## Requirements

- Node.js 20+
- pnpm 10 (`packageManager` in `package.json`)
- Git

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm test:integration
```

## Workflow

1. Branch from `main`.
2. Keep the existing architecture (Citty CLI, Orchestrator, PlanManager, sandboxed workspace).
3. Do not introduce a new package manager, framework, or cloud requirement for basic orchestration.
4. Add or update unit tests next to the behavior you change.
5. Run the commands above. CI also runs format check, pack verification, and Node 20 + 22.
6. Open a pull request. Do not publish npm from the PR.

## Versioning

Bump `package.json` `version` using semver. Update `CHANGELOG.md`. Tag `vMAJOR.MINOR.PATCH` when cutting a release. See [DEPLOYMENT.md](./DEPLOYMENT.md).

## Security

Do not commit `.env`, keys, or credentials. See [SECURITY.md](./SECURITY.md). Report vulnerabilities privately — do not file public issues for secrets or exploits.
