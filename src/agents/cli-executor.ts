import { execa } from 'execa';
import type { ExecutorAgent } from './interfaces.js';
import type { AgentCapabilities, AgentTask, AgentResult } from './types.js';
import { ExecutionError } from '../errors/index.js';

/**
 * CLI-based executor agent.
 */
export class CLIExecutorAgent implements ExecutorAgent {
  readonly id = 'cli-executor';
  readonly name = 'CLI Executor';
  readonly capabilities: AgentCapabilities = {
    planning: false,
    coding: true,
    reviewing: false,
    terminal: true,
    filesystem: true,
  };

  constructor(
    private agentType: 'codex' | 'claude-code',
    private workspaceRoot: string,
  ) {}

  /**
   * Execute a task using a CLI agent.
   */
  async execute(task: AgentTask): Promise<AgentResult> {
    const instruction = this.buildInstruction(task);

    try {
      let command: string;
      let args: string[];

      if (this.agentType === 'codex') {
        command = 'codex';
        args = ['exec', '--prompt', instruction, '--json'];
      } else {
        command = 'claude';
        args = ['--json', '--prompt', instruction];
      }

      const { stdout, stderr, exitCode } = await execa(command, args, {
        cwd: this.workspaceRoot,
        timeout: 5 * 60 * 1000, // 5 minutes
        reject: false,
      });

      let output = stdout;
      let data: any;

      try {
        data = JSON.parse(stdout);
        output = data.output || stdout;
      } catch {
        // Output might not be valid JSON
      }

      const gitDiff = await execa('git', ['diff', '--name-only'], {
        cwd: this.workspaceRoot,
        reject: false,
      });
      const untracked = await execa('git', ['ls-files', '--others', '--exclude-standard'], {
        cwd: this.workspaceRoot,
        reject: false,
      });
      const modifiedFiles = gitDiff.stdout.split('\n').filter(Boolean);
      const filesCreated = untracked.stdout.split('\n').filter(Boolean);

      return {
        status: exitCode === 0 ? 'success' : 'failure',
        summary: output || stderr || 'Executed.',
        filesModified: modifiedFiles,
        filesCreated,
        filesDeleted: [],
        commandsExecuted: [],
        errors: exitCode !== 0 ? [stderr || 'Command failed'] : [],
      };
    } catch (error) {
      throw new ExecutionError(
        `Failed to execute with CLI agent: ${error instanceof Error ? error.message : String(error)}`,
        { agentType: this.agentType, task: task.plan.id },
      );
    }
  }

  private buildInstruction(task: AgentTask): string {
    const parts = [`Task: ${task.plan.title}`, `Description: ${task.plan.objective}`];

    if (task.instructions) {
      parts.push(`Instructions:\n${task.instructions}`);
    }

    if (task.context?.conventions) {
      parts.push(`Conventions:\n${task.context.conventions}`);
    }

    return parts.join('\n\n');
  }
}
