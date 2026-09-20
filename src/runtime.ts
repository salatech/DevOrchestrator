import { WorkspaceManager } from './workspace/manager.js';
import { loadConfig, resolveApiKey } from './config/loader.js';
import type { DevAIConfig } from './config/types.js';
import { ModelOrchestrator } from './providers/orchestrator.js';
import { LLMPlannerAgent } from './agents/llm-planner.js';
import { LLMReviewerAgent } from './agents/llm-reviewer.js';
import { CLIExecutorAgent } from './agents/cli-executor.js';
import { LLMExecutorAgent } from './agents/llm-executor.js';
import type { ExecutorAgent } from './agents/interfaces.js';
import { Orchestrator } from './core/orchestrator.js';
import { PlanManager } from './plans/manager.js';
import { ContextEngine } from './context/engine.js';
import { createProgressHandler } from './ui/progress.js';
import { promptCommandApproval } from './ui/prompts.js';
import { ConfigError, ProviderError } from './errors/index.js';
import { execa } from 'execa';

export interface WorkspaceRuntime {
  root: string;
  workspace: WorkspaceManager;
  config: DevAIConfig;
  planManager: PlanManager;
  contextEngine: ContextEngine;
}

export interface AgentRuntime extends WorkspaceRuntime {
  models: ModelOrchestrator;
  orchestrator: Orchestrator;
  progress: ReturnType<typeof createProgressHandler>;
  warnings: string[];
}

export async function openWorkspace(cwd: string = process.cwd()): Promise<WorkspaceRuntime> {
  const root = await WorkspaceManager.findProjectRoot(cwd);
  const workspace = new WorkspaceManager(root);
  const config = await loadConfig(root);
  const planManager = new PlanManager(root);
  const contextEngine = new ContextEngine(config.limits.maxContextFiles);

  return { root, workspace, config, planManager, contextEngine };
}

export async function requireInitialized(runtime: WorkspaceRuntime): Promise<void> {
  const info = await runtime.workspace.inspect();
  if (!info.hasAIDir) {
    throw new ConfigError('Project is not initialized. Run `devorch init` first.', {
      root: runtime.root,
    });
  }
}

export function requireProviderKey(
  config: DevAIConfig,
  role: 'planner' | 'reviewer' | 'executor' = 'planner',
): void {
  const provider =
    role === 'reviewer'
      ? config.reviewer.provider
      : role === 'executor'
        ? (config.executor.provider ?? config.planner.provider)
        : config.planner.provider;

  if (!resolveApiKey(provider)) {
    const envName =
      provider === 'anthropic'
        ? 'ANTHROPIC_API_KEY'
        : provider === 'google'
          ? 'GOOGLE_API_KEY'
          : 'OPENAI_API_KEY';
    throw new ProviderError(`Missing API key for ${provider}. Set ${envName} and retry.`, {
      provider,
      envName,
    });
  }
}

export async function commandExists(command: string): Promise<boolean> {
  try {
    const result = await execa(command, ['--version'], {
      reject: false,
      timeout: 8_000,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    return result.exitCode === 0 || result.exitCode === 1;
  } catch {
    try {
      const which = process.platform === 'win32' ? 'where' : 'which';
      const result = await execa(which, [command], { reject: false, timeout: 5_000 });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }
}

async function createExecutor(
  config: DevAIConfig,
  workspace: WorkspaceManager,
  models: ModelOrchestrator,
): Promise<{ executor: ExecutorAgent; fallbackMessage?: string }> {
  const agent = config.executor.agent;

  if (agent === 'llm') {
    return { executor: new LLMExecutorAgent(models, workspace) };
  }

  const binary = agent === 'claude-code' ? 'claude' : 'codex';
  const available = await commandExists(binary);

  if (available) {
    return { executor: new CLIExecutorAgent(agent, workspace.getRoot()) };
  }

  const provider = config.executor.provider ?? config.planner.provider;
  if (resolveApiKey(provider)) {
    return {
      executor: new LLMExecutorAgent(models, workspace),
      fallbackMessage: `${binary} CLI not found; falling back to LLM executor.`,
    };
  }

  throw new ProviderError(
    `Executor "${agent}" requires the \`${binary}\` CLI, which was not found. Install it or set executor.agent to "llm" and provide an API key.`,
    { agent, binary },
  );
}

export async function createAgentRuntime(options?: {
  cwd?: string;
  withProgress?: boolean;
}): Promise<AgentRuntime> {
  const workspaceRuntime = await openWorkspace(options?.cwd);
  await requireInitialized(workspaceRuntime);
  requireProviderKey(workspaceRuntime.config, 'planner');

  const progress = createProgressHandler();
  const models = new ModelOrchestrator(workspaceRuntime.config);
  const planner = new LLMPlannerAgent(models);
  const reviewer = new LLMReviewerAgent(models);
  const { executor, fallbackMessage } = await createExecutor(
    workspaceRuntime.config,
    workspaceRuntime.workspace,
    models,
  );

  const orchestrator = new Orchestrator(
    workspaceRuntime.workspace,
    planner,
    executor,
    reviewer,
    workspaceRuntime.config,
    options?.withProgress === false ? undefined : progress.handler,
    async (command, reason) => promptCommandApproval(command, reason),
  );

  return {
    ...workspaceRuntime,
    models,
    orchestrator,
    progress,
    warnings: fallbackMessage ? [fallbackMessage] : [],
  };
}
