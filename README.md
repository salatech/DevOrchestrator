# DevOrchestrator

**DevOrchestrator** is an AI engineering orchestration layer that sits above coding agents. It separates software planning from software execution, allowing you to use multiple AI models for different tasks while maintaining a persistent, local-first context.

## Core Architecture

DevOrchestrator enforces a strict separation of concerns:
- **Planner**: Acts as your AI architect, analyzing the codebase and creating a structured execution plan.
- **Executor**: Your AI coding agent (e.g., Codex, Claude Code), executing the approved plan.
- **Reviewer**: Evaluates the diff against the original requirements.

Your **local workspace** always remains the authoritative source of truth. Plans, architecture decisions, and task statuses are saved directly in your repository within the `.ai/` directory.

## Quick Start

### Installation

```bash
npm install -g devorchestrator
```

### Initializing a Project

Inside your project root:

```bash
devai init
```

This generates `.ai/PROJECT.md`, `.ai/ARCHITECTURE.md`, and `.ai/CONVENTIONS.md` based on your project's stack.

### Workflow

1. **Plan**: `devai plan "Add Google OAuth authentication"`
2. **Approve**: `devai approve PLAN-001`
3. **Execute**: `devai execute PLAN-001`
4. **Review**: `devai review PLAN-001`

### Configuration

Configuration lives in `.ai/.devai.json`. You can configure different models for the planner and reviewer, specify validation commands, and adjust security policies.

API keys can be supplied via environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`).
