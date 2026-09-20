import type { ProviderName } from '../providers/types.js';
import type { CommandPolicy } from '../security/types.js';

/** Configuration for a planner */
export interface PlannerConfig {
  provider: ProviderName;
  model: string;
}

/** Configuration for an executor */
export interface ExecutorConfig {
  agent: 'codex' | 'claude-code' | 'llm';
  provider?: ProviderName;
  model?: string;
}

/** Configuration for a reviewer */
export interface ReviewerConfig {
  provider: ProviderName;
  model: string;
}

/** Validation configuration */
export interface ValidationConfig {
  commands: string[];
}

/** Limits configuration */
export interface LimitsConfig {
  maxIterations: number;
  maxContextFiles: number;
}

/** Security configuration */
export interface SecurityConfig {
  commandPolicies: Record<string, CommandPolicy>;
}

/** Complete DevAI configuration */
export interface DevAIConfig {
  planner: PlannerConfig;
  executor: ExecutorConfig;
  reviewer: ReviewerConfig;
  validation: ValidationConfig;
  limits: LimitsConfig;
  security: SecurityConfig;
}
