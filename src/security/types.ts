/** Command execution policy */
export type CommandPolicy = 'safe' | 'requires_approval' | 'blocked';

/** A command policy rule */
export interface PolicyRule {
  /** Glob or regex pattern to match against commands */
  pattern: string;
  /** Policy to apply */
  policy: CommandPolicy;
  /** Human-readable reason for the policy */
  reason: string;
}

/** Request to execute a command */
export interface CommandRequest {
  /** The command string to execute */
  command: string;
  /** Working directory */
  cwd?: string;
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Environment variables */
  env?: Record<string, string>;
  /** Optional workspace root used to reject path-escaping arguments */
  allowedRoot?: string;
}

/** Result of command execution */
export interface CommandExecutionResult {
  /** The command that was executed */
  command: string;
  /** Exit code */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Whether the command timed out */
  timedOut: boolean;
}
