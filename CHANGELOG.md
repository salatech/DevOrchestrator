# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The package version in `package.json` is the single source of truth. `devorch --version` reads it.

## [0.1.0] - 2026-09-20

### Added

- Local-first plan → approve → execute → review CLI (`devorch`)
- Workspace sandbox, context firewall, and command execution policies
- Optional LLM executor fallback when Codex/Claude CLIs are absent
- Production packaging, CI, release artifacts, and doctor/context diagnostics
- Optional cloud client interfaces (no-op; not required for local use)

[0.1.0]: https://github.com/salatech/DevOrchestrator/releases/tag/v0.1.0
