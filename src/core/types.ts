import type { Plan } from '../plans/types.js';
import type { ReviewResult, AgentResult } from '../agents/types.js';
import type { ExecutionReport, ValidationResult } from '../state/types.js';

/** Options for the orchestrator plan command */
export interface PlanOptions {
  /** Natural language request */
  request: string;
  /** Additional files to include in context */
  includeFiles?: string[];
}

/** Options for the orchestrator execute command */
export interface ExecuteOptions {
  /** Plan ID to execute */
  planId: string;
  /** Skip human approval step */
  skipApproval?: boolean;
}

/** Options for the full run command */
export interface RunOptions {
  /** Natural language request */
  request: string;
  /** Skip approval step */
  skipApproval?: boolean;
  /** Additional files to include in context */
  includeFiles?: string[];
}

/** Execution progress events */
export type ProgressEvent =
  | { stage: 'understanding'; message: string }
  | { stage: 'analyzing'; message: string }
  | { stage: 'building_context'; message: string; fileCount?: number }
  | { stage: 'planning'; message: string }
  | { stage: 'plan_generated'; plan: Plan }
  | { stage: 'awaiting_approval'; plan: Plan }
  | { stage: 'executing'; message: string; iteration?: number }
  | { stage: 'validating'; message: string }
  | { stage: 'reviewing'; message: string }
  | { stage: 'fixing'; message: string; iteration: number }
  | { stage: 'completed'; report: ExecutionReport }
  | { stage: 'failed'; error: string };

/** Progress callback type */
export type ProgressCallback = (event: ProgressEvent) => void;
