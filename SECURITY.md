# Security Policy

DevOrchestrator is designed as a **local-first** application with strong security boundaries.

## Reporting a Vulnerability

If you discover a security vulnerability within DevOrchestrator, please report it via the repository's security advisory tab or directly to the maintainers. Do not open public issues for sensitive vulnerabilities.

## Core Security Boundaries

### Workspace Sandboxing
DevOrchestrator strictly enforces that all filesystem reads and writes must remain within the current project's workspace. Any attempt by an AI agent or malformed configuration to traverse out of the project directory (e.g., `../../.ssh/id_rsa`) will immediately throw a `SecurityError` and halt execution.

### Context Firewall
By default, the following files and directories are automatically excluded from the AI context window:
- `.env` and `.env.*` files
- Any file ending in `.pem`, `.key`, `.p12`, or `.pfx`
- Credentials, secrets, and SSH keys
- Build artifacts (`node_modules`, `dist`, `build`, `coverage`)
- Git history (`.git/`)

### Execution Policies
DevOrchestrator uses a strict command execution policy:
- **Safe**: Read-only checks, test runners, linters (`npm test`, `git status`).
- **Approval Required**: Dependency changes, git commits, destructive operations.
- **Blocked**: Extremely dangerous operations (`rm -rf /`, `DROP TABLE`).

You can customize this policy in your `.devai.json` under `security.commandPolicies`.
