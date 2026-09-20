import type { DevAIConfig } from './types.js';

/** Default configuration values */
export const DEFAULT_CONFIG: DevAIConfig = {
  planner: {
    provider: 'openai',
    model: 'gpt-4o',
  },
  executor: {
    agent: 'codex',
  },
  reviewer: {
    provider: 'openai',
    model: 'gpt-4o',
  },
  validation: {
    commands: [],
  },
  limits: {
    maxIterations: 3,
    maxContextFiles: 30,
  },
  security: {
    commandPolicies: {},
  },
};
