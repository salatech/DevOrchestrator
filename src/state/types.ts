import type { TokenUsage } from '../providers/types.js';
import type { ReviewResult, CommandResult } from '../agents/types.js';
import type { WorkspaceSnapshot } from '../workspace/types.js';

/** Validation result for a single command */
export interface ValidationCommandResult {
  command: string;
  passed: boolean;
  output: string;
  durationMs: number;
}

/** Overall validation result */
export interface ValidationResult {
  allPassed: boolean;
  results: ValidationCommandResult[];
}

/** Complete execution trace */
export interface ExecutionTrace {
  /** Unique run identifier */
  id: string;
  /** Associated plan ID */
  planId: string;
  /** Original user request */
  request: string;
  /** Models used per role */
  models: Record<string, string>;
  /** Files included in context */
  contextFiles: string[];
  /** Number of execution iterations */
  iterations: number;
  /** Commands executed */
  commands: CommandResult[];
  /** Files modified during execution */
  filesModified: string[];
  /** Files created during execution */
  filesCreated: string[];
  /** Files deleted during execution */
  filesDeleted: string[];
  /** Validation results */
  validationResults: ValidationResult | null;
  /** Review results */
  reviewResult: ReviewResult | null;
  /** Token usage per role */
  usage: Record<string, TokenUsage>;
  /** Total duration in milliseconds */
  durationMs: number;
  /** Workspace snapshot before execution */
  snapshotBefore: WorkspaceSnapshot;
  /** Workspace snapshot after execution */
  snapshotAfter: WorkspaceSnapshot | null;
  /** Final status */
  status: 'completed' | 'failed' | 'cancelled';
  /** Error message if failed */
  error?: string;
  /** ISO timestamp when the run started */
  startedAt: string;
  /** ISO timestamp when the run finished */
  finishedAt: string;
}

/** Execution report presented to the user */
export interface ExecutionReport {
  planId: string;
  planTitle: string;
  status: 'completed' | 'failed' | 'cancelled';
  iterations: number;
  filesModified: string[];
  filesCreated: string[];
  filesDeleted: string[];
  linesAdded: number;
  linesRemoved: number;
  validationResults: ValidationResult | null;
  reviewResult: ReviewResult | null;
  durationMs: number;
  error?: string;
}

/** Diff between two workspace snapshots */
export interface SnapshotDiff {
  filesAdded: string[];
  filesRemoved: string[];
  filesModified: string[];
  totalModifiedBefore: number;
  totalModifiedAfter: number;
}
