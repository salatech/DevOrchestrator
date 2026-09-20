import { execa } from 'execa';
import type { CommandRequest, CommandExecutionResult, CommandPolicy } from './types.js';
import { CommandPolicyChecker } from './policy.js';
import { SecurityError } from '../errors/index.js';

export class SecureCommandExecutor {
  private policyChecker: CommandPolicyChecker;

  constructor(
    customPolicies?: Record<string, CommandPolicy>,
    private approvalHandler?: (command: string, reason: string) => Promise<boolean>,
  ) {
    this.policyChecker = new CommandPolicyChecker(customPolicies);
  }

  async execute(request: CommandRequest): Promise<CommandExecutionResult> {
    const { policy, reason } = this.policyChecker.getPolicy(request.command);

    if (policy === 'blocked') {
      throw new SecurityError(`Command blocked: ${reason}`);
    }

    if (policy === 'requires_approval') {
      if (!this.approvalHandler) {
        throw new SecurityError(`Command requires approval but no handler is provided: ${reason}`);
      }
      const approved = await this.approvalHandler(request.command, reason);
      if (!approved) {
        throw new SecurityError(`Command execution denied: ${reason}`);
      }
    }

    return this.executeUnsafe(request);
  }

  async executeUnsafe(request: CommandRequest): Promise<CommandExecutionResult> {
    const startTime = Date.now();
    try {
      const parts = request.command.split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);
      
      const result = await execa(cmd, args, {
        cwd: request.cwd,
        timeout: request.timeoutMs ?? (5 * 60 * 1000), // 5 minutes
        env: request.env,
        all: true
      });
      
      return {
        command: request.command,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode ?? 1,
        durationMs: Date.now() - startTime,
        timedOut: false
      };
    } catch (error: any) {
      return {
        command: request.command,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || '',
        exitCode: error.exitCode || 1,
        durationMs: Date.now() - startTime,
        timedOut: error.timedOut || false
      };
    }
  }
}
