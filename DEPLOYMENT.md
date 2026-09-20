# Deployment & Release Guide

This document outlines how DevOrchestrator is built, tested, and released.

## Architecture

DevOrchestrator currently operates entirely as a local runtime CLI. There are no mandatory cloud services attached to the core execution loop.

## Continuous Integration (CI)

We use GitHub Actions (`.github/workflows/ci.yml`) to automatically validate:
- **Type Checking**: `pnpm typecheck`
- **Unit Tests**: `pnpm test`
- **Build**: `pnpm build`

A Pull Request cannot be merged until all checks pass.

## Cutting a Release

Releases follow standard Semantic Versioning (MAJOR.MINOR.PATCH).

1. **Bump Version**: Update the version inside `package.json`.
2. **Changelog**: Add release notes to a `CHANGELOG.md` or a GitHub Release draft.
3. **Tagging**: Create and push a Git tag matching the version (e.g., `v0.1.0`).
4. **Build**: Run `pnpm build` locally or in CI to generate the `./dist` binaries.
5. **Publish**: Verify contents with `npm pack` (or `pnpm pack`), then run `npm publish` to publish to the npm registry.

## Artifacts

The final published NPM artifact will include:
- `dist/` (The bundled CLI and library code)
- `README.md`
- `package.json`

Development assets (like `tests/`, `.github/`, `.ai/`) are strictly excluded via the `files` array in `package.json`.
