# Deployment & Release Guide

DevOrchestrator is a **local runtime CLI**. There is no hosted app to deploy. Production distribution means publishing an npm package that users install onto their machines.

```
Developer → PR → CI → merge → version bump → git tag vX.Y.Z
  → GitHub Release (tarball artifact) → npm publish (manual) → users run `devorch`
```

Cloud auth/billing/telemetry remains **optional and unimplemented**. The installed CLI must work offline except for the AI provider the user configured.

## Runtime support

| Requirement | Value |
|---|---|
| Node.js | `>= 20` (`engines` in `package.json`, tested on 20 and 22) |
| OS | macOS, Linux, Windows (Node must be installed) |
| Package manager to install the CLI | npm, pnpm, or yarn |
| Package manager to develop this repo | pnpm 10 |
| Git | required for diffs, snapshots, status |
| Optional | `codex` CLI, `claude` CLI, provider API keys |

## Build

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

`pnpm build` runs tsup:

- compiles `src/cli.ts` to `dist/cli.mjs`
- injects `package.json` version as `__DEVAI_VERSION__`
- writes source maps
- adds a Node shebang
- fails on compile errors

The published `bin` is `devorch` → `./dist/cli.mjs`. It does not depend on `tsx` or the git checkout.

## Package contents

`package.json` `files` includes `dist`, `README.md`, `LICENSE`, and `CHANGELOG.md`. Tests, `.ai/state`, `.ai/runs`, and source are excluded.

Verify before any publish:

```bash
pnpm verify:pack
pnpm pack --dry-run
```

Do not publish if the tarball contains `.env`, `tests/`, or `src/`.

## CI

`.github/workflows/ci.yml` on `main` and pull requests (Node 20 and 22):

1. `pnpm install --frozen-lockfile`
2. typecheck
3. format (`pnpm lint` → Prettier check)
4. unit tests
5. build
6. integration tests (built CLI)
7. pack verification

CI never publishes and never deploys infrastructure.

## Release (manual)

1. Update `CHANGELOG.md`.
2. Set `version` in `package.json` (the only version source).
3. Merge to `main`.
4. Tag: `git tag v0.1.0 && git push origin v0.1.0`
5. The Release workflow builds, packs, uploads the `.tgz`, and creates a GitHub Release.
6. Publish to npm **only when maintainers explicitly decide to**:

   ```bash
   pnpm build
   npm publish --access public --tag alpha
   ```

   The package name is `devorch`. The executable is `devorch`. First publish uses the `alpha` dist-tag so `npm install devorch` does not pick it up as a live default until you later `npm dist-tag add devorch@0.1.0 latest`.

There is no automatic `npm publish` from CI.

## User install (after publish)

```bash
npm install -g devorch@alpha
devorch --version
devorch doctor
```

From a GitHub Release tarball:

```bash
npm install -g ./devorch-0.1.0.tgz
```

From this repository without publishing:

```bash
pnpm install
pnpm build
node dist/cli.mjs --help
# or
npm link
```

## Configuration layers

| Layer | Purpose | Secrets? |
|---|---|---|
| Process env (`OPENAI_API_KEY`, `DEVAI_*`) | Credentials and CLI runtime | Yes — never commit |
| `.env.example` | Placeholder documentation | Placeholders only |
| `devai.config.ts` / `.devai.json` / `.ai/.devai.json` | Per-project planner/executor/reviewer | No keys |
| Future `CloudClient` | Optional account/billing | Not required |

See `.env.example` and the README configuration section.

## What must stay local

Workspace files, git history, plans, diffs, and execution traces stay on disk under the project (`.ai/plans`, `.ai/runs`). Only prompts and model responses go to the user-configured AI provider. Traces are gitignored and redacted for common secret patterns.
