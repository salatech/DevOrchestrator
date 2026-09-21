import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { openWorkspace, commandExists } from '../runtime.js';
import { resolveApiKey } from '../config/loader.js';
import { loadRuntimeConfig, isSupportedNode, getNodeMajor } from '../config/runtime.js';
import { fail } from './helpers.js';
import { VERSION } from '../version.js';
import { createCloudClient } from '../cloud/index.js';

interface CheckResult {
  ok: boolean;
  label: string;
  detail: string;
  fix?: string;
}

function printCheck(check: CheckResult): void {
  const icon = check.ok ? pc.green('✓') : pc.red('✗');
  console.log(`${icon} ${check.label}${check.detail ? pc.dim(` — ${check.detail}`) : ''}`);
  if (!check.ok && check.fix) {
    console.log(`    ${pc.cyan('Fix:')} ${check.fix}`);
  }
}

export default defineCommand({
  meta: {
    name: 'doctor',
    description: 'Check runtime, git, API keys, config, and executor availability',
  },
  args: {},
  async run() {
    try {
      p.intro(pc.bgCyan(pc.black(' DevOrchestrator ')));
      const runtimeCfg = loadRuntimeConfig();
      const checks: CheckResult[] = [];

      checks.push({
        ok: isSupportedNode(),
        label: 'Node.js runtime',
        detail: `v${process.versions.node} (need >=${runtimeCfg.minNodeMajor})`,
        fix: `Install Node.js ${runtimeCfg.minNodeMajor}+ from https://nodejs.org or nvm.`,
      });

      const gitOk = await commandExists('git');
      checks.push({
        ok: gitOk,
        label: 'git available',
        detail: gitOk ? 'git is on PATH' : 'git was not found',
        fix: 'Install Git and ensure `git` is on your PATH. DevOrchestrator uses Git for diffs and snapshots.',
      });

      checks.push({
        ok: true,
        label: 'CLI version',
        detail: `${VERSION} (${runtimeCfg.env})`,
      });

      const cloud = createCloudClient();
      checks.push({
        ok: true,
        label: 'cloud control plane',
        detail: cloud.enabled
          ? `enabled (${runtimeCfg.cloudEndpoint ?? 'configured'})`
          : 'disabled (local-first; no account required)',
      });

      try {
        const runtime = await openWorkspace();
        const info = await runtime.workspace.inspect();

        checks.push({
          ok: true,
          label: 'workspace',
          detail: info.root,
        });

        checks.push({
          ok: info.hasAIDir,
          label: '.ai/ directory',
          detail: info.hasAIDir ? 'initialized' : 'missing',
          fix: 'Run `devorch init` in the project root.',
        });

        checks.push({
          ok: true,
          label: 'project config',
          detail: `${runtime.config.planner.provider}/${runtime.config.planner.model}`,
        });

        const plannerKey = resolveApiKey(runtime.config.planner.provider);
        checks.push({
          ok: Boolean(plannerKey),
          label: `planner credentials (${runtime.config.planner.provider})`,
          detail: plannerKey ? 'API key present' : 'API key missing',
          fix:
            runtime.config.planner.provider === 'anthropic'
              ? 'Export ANTHROPIC_API_KEY. Keys never belong in git or `.ai/` files.'
              : runtime.config.planner.provider === 'google'
                ? 'Export GOOGLE_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY). Keys never belong in git or `.ai/` files.'
                : 'Export OPENAI_API_KEY. Keys never belong in git or `.ai/` files.',
        });

        const reviewerKey = resolveApiKey(runtime.config.reviewer.provider);
        checks.push({
          ok: Boolean(reviewerKey),
          label: `reviewer credentials (${runtime.config.reviewer.provider})`,
          detail: reviewerKey ? 'API key present' : 'API key missing',
          fix: 'Set the reviewer provider key, or use the same provider as the planner.',
        });

        const agent = runtime.config.executor.agent;
        if (agent === 'llm') {
          const executorProvider =
            runtime.config.executor.provider ?? runtime.config.planner.provider;
          const keyOk = Boolean(resolveApiKey(executorProvider));
          checks.push({
            ok: keyOk,
            label: 'executor (llm)',
            detail: keyOk ? 'LLM executor ready' : `missing ${executorProvider} API key`,
            fix: `Export the ${executorProvider} API key, or install the Codex/Claude CLI.`,
          });
        } else {
          const binary = agent === 'claude-code' ? 'claude' : 'codex';
          const binaryOk = await commandExists(binary);
          const fallbackKey = resolveApiKey(
            runtime.config.executor.provider ?? runtime.config.planner.provider,
          );
          checks.push({
            ok: binaryOk || Boolean(fallbackKey),
            label: `executor (${agent})`,
            detail: binaryOk
              ? `${binary} CLI found`
              : fallbackKey
                ? `${binary} missing; LLM fallback available`
                : `${binary} CLI not found and no API key for fallback`,
            fix: `Install \`${binary}\`, or set executor.agent to "llm" and provide an API key.`,
          });
        }

        if (runtimeCfg.telemetryEnabled) {
          checks.push({
            ok: true,
            label: 'telemetry',
            detail: 'requested via DEVAI_TELEMETRY, but no data is sent in this version',
          });
        }
      } catch (error) {
        checks.push({
          ok: false,
          label: 'workspace/config',
          detail: error instanceof Error ? error.message : String(error),
          fix: 'Run the command from a project directory, or fix `.ai/.devai.json` / `.devai.json`.',
        });
      }

      for (const check of checks) printCheck(check);

      const requiredFailed = checks.filter(
        (c) =>
          !c.ok &&
          (c.label.startsWith('Node') ||
            c.label.startsWith('git') ||
            c.label.startsWith('.ai') ||
            c.label.startsWith('planner') ||
            c.label.startsWith('workspace/config')),
      );
      const allOk = checks.every((c) => c.ok);
      p.outro(
        allOk
          ? pc.green('Environment looks ready')
          : pc.yellow(
              `${checks.filter((c) => !c.ok).length} check(s) failed. Planning needs a planner key; execution needs an agent or LLM fallback.`,
            ),
      );
      if (!allOk || getNodeMajor() < runtimeCfg.minNodeMajor) process.exitCode = 1;
      if (requiredFailed.length > 0 && !allOk) process.exitCode = 1;
    } catch (error) {
      fail(error);
    }
  },
});
