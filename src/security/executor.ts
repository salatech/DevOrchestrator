import { execa } from 'execa';
import * as path from 'node:path';
import type { CommandRequest, CommandExecutionResult, CommandPolicy } from './types.js';
import { CommandPolicyChecker } from './policy.js';
import { hasShellMetacharacters, tokenizeCommand } from './parse.js';
import { SecurityError } from '../errors/index.js';
import { loadRuntimeConfig } from '../config/runtime.js';
import { redactSecrets } from '../logging/redact.js';

export class SecureCommandExecutor {
  private policyChecker: CommandPolicyChecker;
  private defaultTimeoutMs: number;

  constructor(
    customPolicies?: Record<string, CommandPolicy>,
    private approvalHandler?: (command: string, reason: string) => Promise<boolean>,
  ) {
    this.policyChecker = new CommandPolicyChecker(customPolicies);
    this.defaultTimeoutMs = loadRuntimeConfig().commandTimeoutMs;
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
      if (hasShellMetacharacters(request.command)) {
        throw new SecurityError('Refusing to execute a command that contains shell metacharacters');
      }

      const argv = tokenizeCommand(request.command);
      const cmd = argv[0];
      const args = argv.slice(1);
      if (!cmd) {
        throw new SecurityError('Empty command');
      }

      this.assertWorkspaceArgs(request, args);

      const result = await execa(cmd, args, {
        cwd: request.cwd,
        timeout: request.timeoutMs ?? this.defaultTimeoutMs,
        env: request.env,
        shell: false,
        all: true,
      });

      return {
        command: request.command,
        stdout: redactSecrets(result.stdout),
        stderr: redactSecrets(result.stderr),
        exitCode: result.exitCode ?? 1,
        durationMs: Date.now() - startTime,
        timedOut: false,
      };
    } catch (error: any) {
      if (error instanceof SecurityError) throw error;
      return {
        command: request.command,
        stdout: redactSecrets(error.stdout || ''),
        stderr: redactSecrets(error.stderr || error.message || ''),
        exitCode: error.exitCode || 1,
        durationMs: Date.now() - startTime,
        timedOut: error.timedOut || false,
      };
    }
  }

  private assertWorkspaceArgs(request: CommandRequest, args: string[]): void {
    const root = request.allowedRoot ?? request.cwd;
    if (!root) return;

    const absoluteRoot = path.resolve(root);
    for (const arg of args) {
      if (arg.startsWith('-')) continue;
      if (!(arg.startsWith('/') || arg.startsWith('~') || arg.includes('..'))) continue;

      const expanded = arg.startsWith('~') ? path.join(process.env.HOME ?? '', arg.slice(1)) : arg;
      const resolved = path.resolve(request.cwd ?? absoluteRoot, expanded);
      if (resolved !== absoluteRoot && !resolved.startsWith(absoluteRoot + path.sep)) {
        throw new SecurityError(`Command argument escapes the workspace: ${arg}`);
      }
    }
  }
}
