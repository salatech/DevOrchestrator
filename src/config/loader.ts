import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { DevAIConfigSchema } from './schema.js';
import { DEFAULT_CONFIG } from './defaults.js';
import type { DevAIConfig } from './types.js';
import { ConfigError } from '../errors/index.js';
import { fileExists } from '../workspace/filesystem.js';

export async function loadConfig(projectRoot: string): Promise<DevAIConfig> {
  let rawConfig: any = {};
  
  const tsConfigPath = path.join(projectRoot, 'devai.config.ts');
  const jsonConfigPath = path.join(projectRoot, '.devai.json');
  
  try {
    if (await fileExists(tsConfigPath)) {
      const mod = await import(tsConfigPath);
      rawConfig = mod.default || mod;
    } else if (await fileExists(jsonConfigPath)) {
      const content = await fs.readFile(jsonConfigPath, 'utf8');
      rawConfig = JSON.parse(content);
    }
  } catch (error) {
    throw new ConfigError(`Failed to load config: ${(error as Error).message}`);
  }

  if (process.env.DEVAI_PLANNER_PROVIDER) {
    rawConfig.planner = rawConfig.planner || {};
    rawConfig.planner.provider = process.env.DEVAI_PLANNER_PROVIDER;
  }
  if (process.env.DEVAI_PLANNER_MODEL) {
    rawConfig.planner = rawConfig.planner || {};
    rawConfig.planner.model = process.env.DEVAI_PLANNER_MODEL;
  }
  if (process.env.DEVAI_EXECUTOR_AGENT) {
    rawConfig.executor = rawConfig.executor || {};
    rawConfig.executor.agent = process.env.DEVAI_EXECUTOR_AGENT;
  }
  if (process.env.DEVAI_REVIEWER_PROVIDER) {
    rawConfig.reviewer = rawConfig.reviewer || {};
    rawConfig.reviewer.provider = process.env.DEVAI_REVIEWER_PROVIDER;
  }
  if (process.env.DEVAI_REVIEWER_MODEL) {
    rawConfig.reviewer = rawConfig.reviewer || {};
    rawConfig.reviewer.model = process.env.DEVAI_REVIEWER_MODEL;
  }
  if (process.env.DEVAI_MAX_ITERATIONS) {
    rawConfig.limits = rawConfig.limits || {};
    rawConfig.limits.maxIterations = parseInt(process.env.DEVAI_MAX_ITERATIONS, 10);
  }

  const result = DevAIConfigSchema.safeParse(rawConfig);
  if (!result.success) {
    throw new ConfigError(`Config validation failed: ${result.error.message}`);
  }
  
  return {
    ...DEFAULT_CONFIG,
    ...result.data,
    planner: { ...DEFAULT_CONFIG.planner, ...result.data.planner },
    executor: { ...DEFAULT_CONFIG.executor, ...result.data.executor },
    reviewer: { ...DEFAULT_CONFIG.reviewer, ...result.data.reviewer },
    validation: { ...DEFAULT_CONFIG.validation, ...result.data.validation },
    limits: { ...DEFAULT_CONFIG.limits, ...result.data.limits },
    security: { ...DEFAULT_CONFIG.security, ...result.data.security }
  } as DevAIConfig;
}

export function resolveApiKey(provider: string): string | undefined {
  if (provider === 'openai') return process.env.OPENAI_API_KEY;
  if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY;
  if (provider === 'google') return process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  return undefined;
}
