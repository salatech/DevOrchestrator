import { z } from 'zod';

export const PlannerConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google']).default('openai'),
  model: z.string().default('gpt-4o'),
});

export const ExecutorConfigSchema = z.object({
  agent: z.enum(['codex', 'claude-code', 'llm']).default('codex'),
  provider: z.enum(['openai', 'anthropic', 'google']).optional(),
  model: z.string().optional(),
});

export const ReviewerConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google']).default('openai'),
  model: z.string().default('gpt-4o'),
});

export const ValidationConfigSchema = z.object({
  commands: z.array(z.string()).default([]),
});

export const LimitsConfigSchema = z.object({
  maxIterations: z.number().int().min(1).max(10).default(3),
  maxContextFiles: z.number().int().min(1).max(100).default(30),
});

export const SecurityConfigSchema = z.object({
  commandPolicies: z.record(z.enum(['safe', 'requires_approval', 'blocked'])).default({}),
});

export const DevAIConfigSchema = z.object({
  planner: PlannerConfigSchema.default({}),
  executor: ExecutorConfigSchema.default({}),
  reviewer: ReviewerConfigSchema.default({}),
  validation: ValidationConfigSchema.default({}),
  limits: LimitsConfigSchema.default({}),
  security: SecurityConfigSchema.default({}),
});

export type DevAIConfigInput = z.input<typeof DevAIConfigSchema>;
