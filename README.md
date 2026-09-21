# DevOrchestrator

**DevOrchestrator** (`devorch`) is a local-first CLI that sits above coding agents. It separates **planning**, **execution**, and **review** so you can use different models for different jobs while keeping the repository as the source of truth.

Plans, architecture notes, skills, and run traces live in `.ai/` inside the project. Nothing about the core loop requires a hosted backend.

```
devorch init
devorch plan "Add Google OAuth authentication"
devorch approve PLAN-001
devorch execute PLAN-001
devorch review PLAN-001
```

Current version: **0.1.0**. Requires **Node.js 20+**.

---

## Table of contents

1. [Why it exists](#why-it-exists)
2. [How it works](#how-it-works)
3. [Requirements](#requirements)
4. [Installation](#installation)
5. [Quick start](#quick-start)
6. [Command reference](#command-reference)
7. [The `.ai/` directory](#the-ai-directory)
8. [Plans](#plans)
9. [Execution loop](#execution-loop)
10. [Context engine](#context-engine)
11. [Skills](#skills)
12. [Configuration](#configuration)
13. [Environment variables](#environment-variables)
14. [Executors](#executors)
15. [Providers and models](#providers-and-models)
16. [Security](#security)
17. [Project detection](#project-detection)
18. [Develop this repo](#develop-this-repo)
19. [Distribution and release](#distribution-and-release)
20. [Troubleshooting](#troubleshooting)
21. [Current limitations](#current-limitations)

---

## Why it exists

Coding agents are good at editing files. They are weaker at holding a durable project model, refusing scope creep, and stopping for human approval before they write code.

DevOrchestrator treats those as separate roles:

| Role | Job | Default implementation |
|---|---|---|
| **Planner** | Read the repo and produce a structured plan | Browser chatbot (ChatGPT / Gemini / Claude), or LLM via OpenAI / Anthropic / Google |
| **Human** | Approve, edit, regenerate, or reject | CLI prompts |
| **Executor** | Implement the approved plan | Codex CLI, Claude Code CLI, or LLM fallback |
| **Validator** | Run your test/lint/typecheck commands | Local shell, policy-gated |
| **Reviewer** | Judge the local file changes against acceptance criteria | LLM via OpenAI / Anthropic / Google |

The planner does not implement. The executor does not redefine the objective. The reviewer does not write the plan. The workspace, not chat history, is authoritative.

---

## How it works

```
Request
  │
  ▼
Context engine ─── .ai/PROJECT.md, ARCHITECTURE.md, CONVENTIONS.md
               ─── matched skills
               ─── relevant source files
               ─── git state, package info, existing plans
  │
  ▼
Planner LLM ─── writes .ai/plans/PLAN-00N-title.md  (awaiting_approval)
  │
  ▼
Human approval
  │
  ▼
Executor ─── Codex / Claude Code / LLM file writes
  │
  ▼
Validation commands ─── test, typecheck, lint (optional, from config)
  │
  ▼
Reviewer LLM ─── approved (and project files changed) → completed
             ─── no app files changed, or changes requested → executor retries (up to maxIterations)
  │
  ▼
Trace ─── .ai/runs/RUN-00N.json
```

All filesystem writes go through a workspace sandbox. Validation commands go through a command policy. Secret files are kept out of planner/reviewer context.

---

## Requirements

- **Node.js** `>= 20`
- **Git** in `PATH` (used for status, diffs, snapshots)
- A project root that contains `.git` or `package.json` (DevOrchestrator walks up from the current directory)
- For planning and review: an API key for the configured provider
- For execution, one of:
  - `codex` CLI (`executor.agent = "codex"`)
  - `claude` CLI (`executor.agent = "claude-code"`)
  - an API key, which enables the LLM executor fallback

---

## Installation

After the package is published:

```bash
npm install -g @salatech/devorch
# or
pnpm add -g @salatech/devorch
```

The executable is **`devorch`** (package name `@salatech/devorch`). Then:

```bash
devorch --version
devorch --help
devorch doctor
```

### From this repository

```bash
git clone https://github.com/salatech/DevOrchestrator.git
cd DevOrchestrator
pnpm install
pnpm build
node dist/cli.mjs --help
```

Link globally while developing:

```bash
pnpm build
npm link
devorch --help
```

### Package manager

The published binary name is `devorch` (package name `@salatech/devorch`):

```bash
pnpm add -g @salatech/devorch
# or
npm install -g @salatech/devorch
```

### Development runner (no build)

```bash
pnpm install
pnpm dev --help
pnpm dev doctor
```

`pnpm dev` is `tsx src/cli.ts`.

---

## Quick start

1. Export a provider key:

   ```bash
   export OPENAI_API_KEY=sk-...
   # or
   export ANTHROPIC_API_KEY=sk-ant-...
   ```

2. Inside the target project:

   ```bash
   devorch init
   devorch doctor
   ```

3. Create a plan (browser chatbot, no API key):

   ```bash
   devorch plan --chat gemini "Add rate limiting to the public API"
   ```

   Or import a reply you already saved:

   ```bash
   devorch plan --from reply.md
   ```

   API planner (needs a key): `devorch plan "Add rate limiting to the public API"`.

   You will be asked to **Approve**, **Edit**, **Regenerate**, or **Reject**. After approve, you can execute immediately or later.

4. Execute an approved plan:

   ```bash
   devorch execute PLAN-001
   ```

5. Inspect results:

   ```bash
   devorch status
   devorch diff
   devorch show PLAN-001
   ```

One-shot variant:

```bash
devorch run "Add rate limiting to the public API"
```

`--yes` / `-y` skips confirmation prompts.

---

## Command reference

```
devorch <command> --help
```

| Command | Purpose | Needs `.ai/` | Needs API key |
|---|---|---|---|
| `init` | Create `.ai/` layout, config, stub docs, skills | No | Optional (better docs if present) |
| `plan` | Generate or import a plan | Yes | No for `--chat` / `--from` / `--link`; yes for API planner |
| `approve` | Mark a plan approved (or reopen completed/failed) | Yes | No |
| `execute` | Run an approved plan (or re-run completed/failed) | Yes | Yes (or executor CLI) |
| `review` | Review local workspace changes against a plan | Yes | Yes |
| `run` | Plan + approve + execute | Yes | Yes |
| `plans` | List plans | Yes | No |
| `show` | Print one plan | Yes | No |
| `status` | Project, git, active plan, models | Yes | No |
| `context` | Preview planner context | Yes | No |
| `diff` | Local workspace changes (git if available) | Yes | No |
| `doctor` | Environment checks | No | No |

### `devorch init`

Detects the workspace root, stack, package manager, and scripts, then creates:

- `.ai/PROJECT.md`, `.ai/ARCHITECTURE.md`, `.ai/CONVENTIONS.md`
- `.ai/.devai.json` with detected validation scripts when possible
- `.ai/plans/`, `.ai/tasks/`, `.ai/skills/`, `.ai/state/`, `.ai/runs/`, `.ai/inbox/`
- stub skills (`testing`, and `typescript` when JS/TS is detected)
- `.ai/.gitignore` for `state/` and `runs/`
- root `.gitignore` entries for `.ai/state/`, `.ai/runs/`, and `.ai/inbox/`

If `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GOOGLE_API_KEY` is set, init asks the planner model to draft PROJECT.md and ARCHITECTURE.md. On failure it falls back to stubs.

| Flag | Description |
|---|---|
| `--force` | Overwrite stub documentation and `.devai.json` |

If `.ai/` already exists, init fills in missing files unless `--force` is passed.

### `devorch plan "<request>"`

**Preferred (no API key):** plan in ChatGPT, Gemini, or Claude in your browser, then import the reply.

```bash
devorch plan --chat gemini "create a normal calculator app with html and css and js"
```

That copies a local-context prompt, opens the chatbot, and waits until you save the reply to `.ai/inbox/plan.md` (or another file with `--from`). Then it becomes `PLAN-00N`.

**Already planned in the browser?** For ChatGPT and Claude, import a **public** share link:

```bash
devorch plan --link "https://chatgpt.com/share/xxxxxxxx"
devorch plan --link "https://claude.ai/share/xxxxxxxx"
```

Gemini public share pages (`share.gemini.google/…`, `gemini.google.com/share/…`, `g.co/gemini/share/…`) load the conversation with JavaScript in the browser, so `--link` cannot read the replies from HTML. Copy Gemini’s reply into a file in the project, then:

```bash
devorch plan --from reply.md
```

`--from` must point at a real file (relative to the project). If the file is missing, the command fails instead of importing whatever is on the clipboard.

The ChatGPT/Claude chat must be a **public share link** (Share → copy link). A normal private chat URL will not work.

```bash
devorch plan --chat chatgpt "…"
devorch plan --chat claude "…"
devorch plan --from .ai/inbox/plan.md
```

**API planner:** `devorch plan "…"` still calls the configured provider key (OpenAI / Anthropic / Gemini API).

After import it prompts Approve / Edit / Regenerate / Reject as before.

| Argument / flag | Description |
|---|---|
| `<request>` | Natural-language task (required unless `--from`) |
| `--chat chatgpt\|gemini\|claude` | Plan in the browser chatbot (no API key) |
| `--link <url>` | Import a public ChatGPT or Claude share (Gemini: use `--from`) |
| `--from <file>` | Import a saved chatbot reply (file must exist in the project) |
| `--include <files>` | Comma-separated extra files to force into context |
| `--yes`, `-y` | Approve immediately (does not auto-execute) |

Example:

```bash
devorch plan --chat gemini "Add Google OAuth"
```

### `devorch approve <plan-id>`

Loads the plan, shows it, and transitions:

- `draft` → `awaiting_approval` → `approved`
- `awaiting_approval` → `approved`
- `completed` or `failed` → `approved` (re-open so you can execute again)

Already-approved plans are left unchanged.

| Flag | Description |
|---|---|
| `--yes`, `-y` | Skip confirmation |

### `devorch execute <plan-id>`

Requires status `approved`, or confirms before reopening `completed` / `failed` back to `approved`. Then runs the [execution loop](#execution-loop). Works in folders that are not git repositories (review uses local files, not git-only diffs).

| Flag | Description |
|---|---|
| `--yes`, `-y` | Skip the “this will modify the workspace” confirmation |

If the configured CLI agent is missing and an API key exists, DevOrchestrator warns and falls back to the LLM executor.

### `devorch review <plan-id>`

Reviews **local workspace files** (and git diff if present) against the plan’s objective and acceptance criteria. If the plan is `executing` or `validating`, it moves to `reviewing`; if the reviewer approves from `reviewing` **and** project files outside `.ai/` changed, the plan becomes `completed`.

### `devorch run "<request>"`

Full workflow: plan, show, approve, execute.

| Argument / flag | Description |
|---|---|
| `<request>` | Natural-language task (required) |
| `--include <files>` | Extra context files |
| `--yes`, `-y` | Skip approval and execute immediately |

Without `--yes`, rejecting the plan cancels it. Approving without executing leaves it `approved` for a later `devorch execute`.

### `devorch plans`

Lists every plan in `.ai/plans/` (table: ID, title, status, updated).

| Flag | Description |
|---|---|
| `--status <status>` | Filter, e.g. `approved`, `completed`, `awaiting_approval` |

### `devorch show <plan-id>`

Prints the full formatted plan (objective, files, steps, constraints, risks, acceptance criteria).

Plan files are resolved by filename (`PLAN-001-*.md` or `PLAN-001.md`) or by YAML `id` in frontmatter, so `000-mvp.md` with `id: PLAN-000` still works.

### `devorch status`

Prints:

- project name and detected stack
- workspace root
- branch and dirty-file counts
- first non-terminal / in-flight plan
- planner, executor, reviewer settings
- last run from `.ai/runs/`

### `devorch context [request]`

Assembles planner context **without calling an LLM**. Use this to debug file selection.

Default request is `general`. Example:

```bash
devorch context "oauth session jwt"
```

Shows which `.ai/` docs loaded, scored files, matched skills, git branch, and plan count.

### `devorch diff`

Shows local workspace changes first (files on disk). `--staged` still uses git, when the folder is a git repo.

| Flag | Description |
|---|---|
| `--staged` | Staged diff only |

### `devorch doctor`

Checks:

- `git` on PATH
- `.ai/` present
- config loads
- planner and reviewer API keys
- executor CLI **or** LLM fallback key

Non-zero exit if any check fails. Safe to run before the first plan.

---

## The `.ai/` directory

Created by `devorch init`:

```
.ai/
├── .devai.json          # Project config (see Configuration)
├── .gitignore           # ignores state/ and runs/
├── PROJECT.md           # Purpose, stack, commands, constraints
├── ARCHITECTURE.md      # System overview and components
├── CONVENTIONS.md       # Style, naming, testing, architecture rules
├── plans/               # PLAN-00N-*.md (committed)
├── tasks/               # Reserved for future task breakdowns
├── skills/              # skills/<name>/SKILL.md
├── state/               # Runtime state (gitignored)
└── runs/                # RUN-00N.json execution traces (gitignored)
```

**Commit** `PROJECT.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`, `skills/`, `plans/`, and `.devai.json`. Those files are how later plans stay consistent.

**Do not commit** `.ai/state/` or `.ai/runs/` (init adds gitignore rules).

Fill in the markdown stubs. The planner and reviewer receive them on every run.

---

## Plans

Plans are Markdown with YAML frontmatter. Example filename: `.ai/plans/PLAN-001-add-rate-limiting.md`.

### Frontmatter

| Field | Meaning |
|---|---|
| `id` | `PLAN-NNN` (zero-padded, auto-assigned) |
| `title` | Short title |
| `status` | See lifecycle below |
| `created` / `updated` | Dates |
| `planner` | Model/agent that wrote the plan |
| `branch` | Git branch at creation |

### Body sections

The parser reads `#` headings and known `##` headings:

- Objective
- Current State
- Relevant Files
- Files To Modify
- Files To Create
- Implementation Steps (`## Step N: Title`)
- Constraints
- Testing Strategy
- Acceptance Criteria
- Risks
- Out Of Scope
- Dependencies

A plan cannot be saved without an id matching `PLAN-\d{3}`, a title, an objective, at least one implementation step, and at least one acceptance criterion. The orchestrator fills safe defaults if the model omits them.

### Lifecycle

```
draft
  → awaiting_approval
      → approved → executing ─┬→ validating → reviewing → completed
                              │                 │
                              │                 └→ executing (retry)
                              └→ reviewing (no validation commands)
                              └→ failed
      → cancelled

failed → draft or approved   (re-open)
completed → approved         (re-run)
cancelled is terminal
```

| Status | Meaning |
|---|---|
| `draft` | Parsed but not yet offered for approval |
| `awaiting_approval` | Written to disk, waiting on a human |
| `approved` | Allowed to execute |
| `executing` | Coding agent is working |
| `validating` | Configured validation commands are running |
| `reviewing` | Reviewer is judging the diff |
| `completed` | Reviewer approved and project files changed; can be re-run |
| `failed` | Blocked, validation never passed, max iterations hit, or no app files changed; can be re-opened |
| `cancelled` | Rejected or abandoned |

Invalid transitions throw `PlanningError`.

---

## Execution loop

`devorch execute PLAN-00N` (and `devorch run --yes`):

1. Load the plan; require `approved` (or `reviewing` to retry). `completed` / `failed` can be reopened to `approved` from the execute prompt.
2. Transition to `executing`.
3. Snapshot local files (fingerprints) and git state when git exists.
4. Rebuild context from the plan objective.
5. For `iteration = 1..limits.maxIterations`:
   1. Send plan + instructions + prior feedback to the executor.
   2. If the executor returns `blocked`, mark `failed` and stop.
   3. If `validation.commands` is non-empty, run each command under the security policy.
      - Failure feeds the command output back to the executor and retries.
   4. Reviewer sees **local file changes** (preferred) plus git diff if available, and the validation summary.
      - `approved` **and** files outside `.ai/` changed → `completed`
      - `approved` but only `.ai/` (or nothing) changed → retry, or `failed` after max iterations (the report matches the plan status)
      - `changes_requested` → findings go back to the executor
6. Snapshot again, write `.ai/runs/RUN-00N.json`, print an execution report (files, line stats, validation, review, duration).

Instructions to the executor include the plan steps, files to modify/create, constraints, previous validation/review feedback, and an explicit rule: **do not redefine the objective**.

---

## Context engine

Before planning (and again before execute/review), DevOrchestrator gathers:

| Source | Path / method |
|---|---|
| Project brief | `.ai/PROJECT.md` |
| Architecture | `.ai/ARCHITECTURE.md` |
| Conventions | `.ai/CONVENTIONS.md` |
| Skills | `.ai/skills/*/SKILL.md` matched to the request |
| Source files | Heuristic selection, capped by `limits.maxContextFiles` (default 30) |
| Git | Branch, dirty files, recent commits |
| Plans | Existing plan summaries |
| Package | `package.json` name and dependencies |

### File scoring

Keywords are extracted from the request (stop-words stripped). Files score higher when:

- the path contains a keyword
- the file was recently modified
- it is a config/entry file (`package.json`, `tsconfig.json`, `index.ts`, …)
- it matches domain boosts (auth, routes/API, database/schema)
- it is a test file associated with an already-relevant source file

`--include` on `plan` / `run` always adds those paths if they exist.

Use `devorch context "your request"` to see the ranking before spending tokens.

### Context firewall

These are never selected as source context:

- `.env`, `.env.*` except `.env.example`
- `*.pem`, `*.key`, `*.p12`, `*.pfx`
- `id_rsa` / `id_dsa` / `id_ecdsa` / `id_ed25519`
- `credentials.json`, `secret(s).*`
- `node_modules`, `.git`, `dist`, `build`, coverage and cache dirs

---

## Skills

A skill is a directory:

```
.ai/skills/testing/SKILL.md
```

Minimum shape:

```markdown
# testing

## Purpose
How to write and run tests in this repository.

## When To Use
When adding features, fixing bugs, or changing behavior that needs verification.
```

`init` creates `testing` (always) and `typescript` when JS/TS is detected. Add your own (`database`, `frontend`, `auth`, …). Discovery tokenizes the user request against skill keywords and the **When To Use** section; matching skills are injected into the planner prompt.

---

## Configuration

Loaded from the **first file that exists**, in this order:

1. `devai.config.ts` at the project root
2. `.devai.json` at the project root
3. `.ai/.devai.json`

`devorch init` writes `.ai/.devai.json`. Zod validates and merges with defaults. Environment variables override file values after parse.

### Full schema

```json
{
  "planner": {
    "provider": "openai",
    "model": "gpt-4o"
  },
  "executor": {
    "agent": "codex",
    "provider": "openai",
    "model": "gpt-4o"
  },
  "reviewer": {
    "provider": "openai",
    "model": "gpt-4o"
  },
  "validation": {
    "commands": ["pnpm test", "pnpm typecheck"]
  },
  "limits": {
    "maxIterations": 3,
    "maxContextFiles": 30
  },
  "security": {
    "commandPolicies": {
      "pnpm test": "safe",
      "custom-script": "requires_approval"
    }
  }
}
```

| Key | Allowed values | Default | Notes |
|---|---|---|---|
| `planner.provider` | `openai`, `anthropic`, `google` | `openai` | Google is accepted in config; runtime still needs `@ai-sdk/google` |
| `planner.model` | any string | `gpt-4o` | e.g. `claude-sonnet-4-5` |
| `executor.agent` | `codex`, `claude-code`, `llm` | `codex` | See [Executors](#executors) |
| `executor.provider` / `model` | same as planner | planner’s settings | Used by the LLM executor |
| `reviewer.provider` / `model` | same as planner | `openai` / `gpt-4o` | Independent of planner |
| `validation.commands` | string[] | `[]` | Empty skips the validating stage |
| `limits.maxIterations` | 1–10 | `3` | Executor retries after failed tests or review |
| `limits.maxContextFiles` | 1–100 | `30` | File cap for the planner prompt |
| `security.commandPolicies` | map of pattern → `safe` \| `requires_approval` \| `blocked` | `{}` | Custom rules are checked **before** built-in lists |

`init` pre-fills `validation.commands` from `package.json` scripts named `test`, `typecheck`, and/or `lint`.

TypeScript config example (`devai.config.ts`):

```ts
export default {
  planner: { provider: 'anthropic', model: 'claude-sonnet-4-5' },
  executor: { agent: 'llm' },
  reviewer: { provider: 'anthropic', model: 'claude-sonnet-4-5' },
  validation: { commands: ['pnpm test', 'pnpm typecheck'] },
  limits: { maxIterations: 3, maxContextFiles: 40 },
};
```

---

## Environment variables

### Provider keys

| Variable | Used when |
|---|---|
| `OPENAI_API_KEY` | `provider` is `openai` |
| `ANTHROPIC_API_KEY` | `provider` is `anthropic` |
| `GOOGLE_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` | `provider` is `google` |

### Config overrides

These overlay the JSON/TS file:

| Variable | Sets |
|---|---|
| `DEVAI_PLANNER_PROVIDER` | `planner.provider` |
| `DEVAI_PLANNER_MODEL` | `planner.model` |
| `DEVAI_EXECUTOR_AGENT` | `executor.agent` |
| `DEVAI_REVIEWER_PROVIDER` | `reviewer.provider` |
| `DEVAI_REVIEWER_MODEL` | `reviewer.model` |
| `DEVAI_MAX_ITERATIONS` | `limits.maxIterations` |

Example:

```bash
DEVAI_PLANNER_PROVIDER=anthropic \
DEVAI_PLANNER_MODEL=claude-sonnet-4-5 \
DEVAI_EXECUTOR_AGENT=llm \
devorch plan "Describe the auth module"
```

---

## Executors

### Codex (`executor.agent = "codex"`)

Spawns:

```bash
codex exec --prompt "<plan instructions>" --json
```

Working directory is the project root. Timeout: 5 minutes. After the process exits, DevOrchestrator records `git diff --name-only` and untracked files.

### Claude Code (`executor.agent = "claude-code"`)

Spawns:

```bash
claude --json --prompt "<plan instructions>"
```

Same capture rules as Codex.

### LLM executor (`executor.agent = "llm"`)

Used when you set `llm`, or automatically when the Codex/Claude binary is missing **and** an API key is available.

The model returns structured file operations (`write` / `delete`). Writes go through `WorkspaceManager`, which **refuses paths outside the project root**. This path does not run an arbitrary shell; it only edits files.

### Fallback order

1. Configured CLI agent if the binary exists.
2. Else LLM executor if a key exists for `executor.provider` (or planner provider).
3. Else `ProviderError` telling you to install `codex`/`claude` or set `executor.agent` to `llm`.

---

## Providers and models

Planner, reviewer, and LLM executor go through `ModelOrchestrator`, a thin wrap around the Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`). Core code does not import provider-specific types.

| Provider | Status |
|---|---|
| OpenAI | Supported |
| Anthropic | Supported |
| Google | Allowed in config / env; runtime currently errors until `@ai-sdk/google` is installed |

You can use different providers per role, for example Anthropic to plan and OpenAI to review.

Token usage is tracked per role during a process; estimated cost is a rough GPT-4o-style heuristic, not a bill.

---

## Security

DevOrchestrator is local-first. See [SECURITY.md](./SECURITY.md) for reporting vulnerabilities.

### Workspace sandbox

Every relative read/write/delete is resolved against the project root. Paths that escape (`../.ssh/id_rsa`, `/etc/passwd`) throw `SecurityError` and stop.

### Command policy

Validation commands (and any future shell use through `SecureCommandExecutor`) are classified as:

- **safe** — run immediately
- **requires_approval** — interactive confirm in the TTY; denied if no handler
- **blocked** — always throws `SecurityError`

Unknown commands default to **requires_approval**. Custom `security.commandPolicies` win over defaults.

**Safe (subset):** `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `npm test`, `yarn test`, `tsc --noEmit`, `npx vitest run`, `git status`, `git diff`, `git log`, `cargo test`, `go test`, `python -m pytest`.

**Needs approval (subset):** `npm install`, `pnpm add`, `git commit`, `git push`, `git checkout`, `git merge`, `pip install`, `npx prisma migrate`.

**Blocked (subset):** `rm -rf /`, `rm -rf *`, `mkfs`, `dd if=`, fork bombs, `curl | sh`, `git push --force`, `DROP TABLE`, `DELETE FROM`, `TRUNCATE`.

### What the LLM executor cannot do

It cannot write outside the workspace. It does not get a shell. Secret files are not placed in its context by the file selector.

---

## Project detection

`devorch init` and `devorch status` inspect the workspace.

| Signal | Result |
|---|---|
| `package.json` | `nodejs` |
| `Cargo.toml` | `rust` |
| `pyproject.toml` / `requirements.txt` | `python` |
| `go.mod` | `go` |
| `pom.xml` / `build.gradle` | `java` |
| `Gemfile` | `ruby` |
| `*.csproj` | `dotnet` |

Package manager: `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lock(b)` → bun, `package-lock.json` → npm.

Frameworks (examples): Next.js, Nuxt, Vite/React, Vue, SvelteKit, Express, Fastify, NestJS, Django — from config files and `package.json` dependencies.

The walk for project root stops at the nearest directory containing `.git` or `package.json`.

---

## Develop this repo

```bash
pnpm install          # lockfile: pnpm@10.14.0
pnpm dev --help       # run CLI from TypeScript
pnpm test             # Vitest unit tests
pnpm typecheck        # tsc --noEmit
pnpm build            # tsup → dist/cli.mjs (shebang)
pnpm format           # Prettier on src/ and tests/
```

| Path | Responsibility |
|---|---|
| `src/cli.ts` | Citty entry; lazy-loaded subcommands |
| `src/commands/` | User-facing commands |
| `src/runtime.ts` | Workspace + orchestrator bootstrap |
| `src/core/orchestrator.ts` | Plan / execute / review loop |
| `src/plans/` | Parse, serialize, CRUD, state machine |
| `src/context/` | Collect and score context |
| `src/agents/` | Planner, reviewer, CLI executor, LLM executor |
| `src/providers/` | ModelOrchestrator + usage tracker |
| `src/workspace/` | Sandboxed FS, git, stack detection |
| `src/security/` | Command policy + gated exec |
| `src/skills/` | Load and match SKILL.md files |
| `src/state/` | Snapshots and `.ai/runs` traces |
| `src/config/` | Zod schema, loader, defaults |
| `src/ui/` | Plan/report formatting, prompts, spinners |
| `tests/unit/` | Unit tests (plans, security, context, config, workspace, skills) |

CI (`.github/workflows/ci.yml`) on `main` and pull requests: typecheck, test, build on Node 22.

Release notes: [DEPLOYMENT.md](./DEPLOYMENT.md). Security reports: [SECURITY.md](./SECURITY.md). Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## Distribution and release

DevOrchestrator ships as a **local npm CLI**, not a cloud app.

- Version: `package.json` only; `devorch --version` matches it
- Build: `pnpm build` → `dist/cli.mjs`
- Verify tarball: `pnpm verify:pack`
- CI: typecheck, format, tests, build, integration, pack (Node 20 and 22)
- Tags `v*.*.*` build GitHub Release artifacts; **npm publish is manual**

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full pipeline. Process env templates: [`.env.example`](./.env.example).

---

## Troubleshooting

### `Project is not initialized`

Run `devorch init` in the project (or a subdirectory of it).

### `Missing API key for openai`

Export `OPENAI_API_KEY` (or switch `planner.provider` / set `ANTHROPIC_API_KEY`). Confirm with `devorch doctor`.

### `Plan PLAN-00N is not approved` / cannot execute from `completed`

`execute` accepts `approved` or `reviewing`. Completed or failed plans can be run again: `devorch execute PLAN-00N` asks to reopen them. Or run `devorch approve PLAN-00N` first.

### `Executor "codex" requires the \`codex\` CLI`

Install Codex, or set `"executor": { "agent": "llm" }` and provide an API key. If a key is already present, execute should fall back automatically and print a warning.

### Validation always fails

Run the same commands yourself. Check `validation.commands` in `.ai/.devai.json`. Commands that are not on the safe list need TTY approval or a custom `safe` policy.

### Planner picked the wrong files

```bash
devorch context "your request"
```

Add `--include path/a.ts,path/b.ts` or mention distinctive path tokens in the request. Raise `limits.maxContextFiles` if the repo is large and relevant files are truncated.

### Config file seems ignored

Only **one** config file is read. `devai.config.ts` wins over root `.devai.json`, which wins over `.ai/.devai.json`. `init` writes the last of those.

### Google provider errors

Set `GOOGLE_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`. Confirm with `devorch doctor`. The Google adapter (`@ai-sdk/google`) is included.

### Gemini `--link` says the page has no conversation text

That is expected. Gemini share pages are a JavaScript app. Copy the assistant reply into `reply.md` in the project folder and run `devorch plan --from reply.md`.

### `--from reply.md` cannot read the file

The path is resolved from the **project root** (the folder with `.ai/`), not necessarily the directory you ran the command from if you are elsewhere. Put the file in the project and pass a path relative to that root.

---

## Current limitations

MVP (0.1.0) does **not** include:

- MCP server or editor extension
- embeddings / semantic search (file selection is heuristic)
- GitHub PR creation
- cloud sync or team-shared context beyond git
- multi-agent parallel execution
- importing Gemini public share pages (`--link`); use `--from` instead
- a separate `validation/` package (validation runs inside the orchestrator)

The product is a **local CLI**. Keep secrets in the environment, not in `.ai/` docs.
