# Security Policy

DevOrchestrator is a **local-first** CLI. The workspace is the source of truth. Do not assume a cloud boundary will protect secrets.

## Reporting a vulnerability

Report security issues through this repository's **GitHub Security Advisories** tab:

https://github.com/salatech/DevOrchestrator/security/advisories/new

Do **not** open a public issue for credential leaks, path traversal, command injection, or similar. Do not include live API keys in the report; redact them.

## What the runtime guarantees

### Workspace sandbox

Filesystem reads, writes, and deletes go through `enforceSafePath`. Paths that resolve outside the project root throw `SecurityError`.

### Context firewall

These are not selected as model context (and `--include` cannot force secrets in):

- `.env`, `.env.*` except `.env.example`
- `*.pem`, `*.key`, `*.p12`, `*.pfx`, keystores
- `credentials.*`, `secrets.*`, `service-account*` files
- SSH private keys and typical cloud credential directories
- `node_modules`, `.git`, `dist`, `build`, coverage/cache dirs

Inspect before sending:

```bash
devorch context "your request"
```

The command lists **included** files, **excluded** files, and the **reason**.

### Command policy

Validation commands are classified as `safe`, `requires_approval`, or `blocked`.

- Shell metacharacters (`;`, `|`, `` ` ``, `$`, …) are blocked (no shell invocation).
- Commands run as argv via `execa` (`shell: false`).
- Arguments that escape the workspace are blocked.
- Force-push, `git reset --hard`, `sudo`, and destructive `rm` patterns are blocked by default.

Customize with `security.commandPolicies` in project config. Custom rules cannot be used to smuggle a blocked shell pipeline.

### Logging and traces

`.ai/runs/*.json` is gitignored. Saved output is passed through secret redaction (API key-like strings, bearer tokens, PEM blocks). Do not paste traces into public issues.

### Providers

API keys live in the environment (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, …), never in `.ai/` documents or source. The CLI does not upload the repository to a DevOrchestrator cloud.

## Out of scope for this policy

A future optional cloud control plane must not require uploading the workspace. If you find a change that sends source or secrets off-machine without an explicit user-configured provider call, treat it as a vulnerability.
