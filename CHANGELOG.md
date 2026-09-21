# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The package version in `package.json` is the single source of truth. `devorch --version` reads it.

## [0.2.0] - 2026-09-21

### Added

- Browser planning with `devorch plan --chat chatgpt|gemini|claude` (no API key)
- Import saved replies with `--from` and public ChatGPT/Claude shares with `--link`
- Google Gemini API planner via `GOOGLE_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`
- Local-first execute/review when the folder is not a git repo
- Re-run completed or failed plans from `execute` / `approve`

### Fixed

- CLI errors print the real cause instead of a bare `fetch failed`
- Empty runs that only touch `.ai/` are not marked completed
- Gemini public share pages explain that `--from` is required (JS shell, no HTML replies)

## [0.1.0] - 2026-09-20

### Added

- Local-first plan → approve → execute → review CLI (`devorch`)
- Workspace sandbox, context firewall, and command execution policies
- Optional LLM executor fallback when Codex/Claude CLIs are absent
- Production packaging, CI, release artifacts, and doctor/context diagnostics
- Optional cloud client interfaces (no-op; not required for local use)

[0.2.0]: https://github.com/salatech/DevOrchestrator/releases/tag/v0.2.0
[0.1.0]: https://github.com/salatech/DevOrchestrator/releases/tag/v0.1.0
