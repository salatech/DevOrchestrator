import type { Plan } from '../plans/types.js';
import type { TaskContext } from '../context/types.js';

/** Agent capabilities */
export interface AgentCapabilities {
  planning: boolean;
  coding: boolean;
  reviewing: boolean;
  terminal: boolean;
  filesystem: boolean;
}

/** Task to be executed by an agent */
export interface AgentTask {
  /** The plan to execute */
  plan: Plan;
  /** Assembled project context */
  context: TaskContext;
  /** Natural language instructions */
  instructions: string;
  /** Constraints to follow */
  constraints: string[];
  /** What must be true when done */
  acceptanceCriteria: string[];
}

/** Result of a command execution */
export interface CommandResult {
  /** The command that was executed */
  command: string;
  /** Exit code */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error output */
  stderr: string;
  /** Duration in milliseconds */
  durationMs: number;
}

/** Result of agent execution */
export interface AgentResult {
  /** Overall status */
  status: 'success' | 'failure' | 'blocked';
  /** Files that were modified */
  filesModified: string[];
  /** Files that were created */
  filesCreated: string[];
  /** Files that were deleted */
  filesDeleted: string[];
  /** Commands that were executed */
  commandsExecuted: CommandResult[];
  /** Human-readable summary of changes */
  summary: string;
  /** Error messages */
  errors: string[];
  /** Reason the agent is blocked (only if status is 'blocked') */
  blockReason?: string;
  /** Suggested plan modification (only if status is 'blocked') */
  suggestedModification?: string;
}

/** Review finding */
export interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  file?: string;
  line?: number;
  description: string;
  recommendation: string;
}

/** Result of a code review */
export interface ReviewResult {
  status: 'approved' | 'changes_requested';
  findings: Finding[];
  summary: string;
}
