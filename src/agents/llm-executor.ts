import { z } from 'zod';
import type { ExecutorAgent } from './interfaces.js';
import type { AgentCapabilities, AgentTask, AgentResult } from './types.js';
import type { ModelOrchestrator } from '../providers/orchestrator.js';
import type { WorkspaceManager } from '../workspace/manager.js';
import { ExecutionError } from '../errors/index.js';

const FileChangeSchema = z.object({
  files: z.array(
    z.object({
      path: z.string(),
      action: z.enum(['write', 'delete']),
      content: z.string().optional(),
    }),
  ),
  summary: z.string(),
});

/**
 * LLM-based executor that applies structured file changes inside the workspace.
 */
export class LLMExecutorAgent implements ExecutorAgent {
  readonly id = 'llm-executor';
  readonly name = 'LLM Executor';
  readonly capabilities: AgentCapabilities = {
    planning: false,
    coding: true,
    reviewing: false,
    terminal: false,
    filesystem: true,
  };

  constructor(
    private modelOrchestrator: ModelOrchestrator,
    private workspace: WorkspaceManager,
  ) {}

  async execute(task: AgentTask): Promise<AgentResult> {
    const systemPrompt = this.buildSystemPrompt();
    const userMessage = this.buildUserMessage(task);

    try {
      const { object } = await this.modelOrchestrator.generateStructured(
        'executor',
        {
          systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
          temperature: 0.2,
        },
        FileChangeSchema,
      );

      return this.applyChanges(object.files, object.summary);
    } catch {
      const response = await this.modelOrchestrator.generate('executor', {
        systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        temperature: 0.2,
      });
      const parsed = this.parseTextChanges(response.content);
      return this.applyChanges(parsed.files, parsed.summary || response.content.slice(0, 500));
    }
  }

  private async applyChanges(
    files: z.infer<typeof FileChangeSchema>['files'],
    summary: string,
  ): Promise<AgentResult> {
    const filesModified: string[] = [];
    const filesCreated: string[] = [];
    const filesDeleted: string[] = [];
    const errors: string[] = [];

    for (const change of files) {
      const relativePath = change.path.replace(/^\.\//, '').trim();
      if (!relativePath) continue;

      try {
        if (change.action === 'delete') {
          await this.workspace.deleteFile(relativePath);
          filesDeleted.push(relativePath);
          continue;
        }

        const existed = await this.workspace.fileExists(relativePath);
        await this.workspace.writeFile(relativePath, change.content ?? '');
        if (existed) {
          filesModified.push(relativePath);
        } else {
          filesCreated.push(relativePath);
        }
      } catch (error) {
        errors.push(`${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (
      errors.length > 0 &&
      filesModified.length + filesCreated.length + filesDeleted.length === 0
    ) {
      throw new ExecutionError(`LLM executor failed to apply changes:\n${errors.join('\n')}`);
    }

    return {
      status: errors.length > 0 ? 'failure' : 'success',
      filesModified,
      filesCreated,
      filesDeleted,
      commandsExecuted: [],
      summary,
      errors,
    };
  }

  private parseTextChanges(content: string): z.infer<typeof FileChangeSchema> {
    const files: z.infer<typeof FileChangeSchema>['files'] = [];
    const fileBlock = /(?:^|\n)(?:#{1,3}\s*)?FILE:\s*([^\n]+)\n```(?:[\w.-]*\n)?([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    while ((match = fileBlock.exec(content)) !== null) {
      files.push({
        path: match[1].trim(),
        action: 'write',
        content: match[2].replace(/\n$/, ''),
      });
    }

    const deleteBlock = /(?:^|\n)(?:#{1,3}\s*)?DELETE:\s*([^\n]+)/g;
    while ((match = deleteBlock.exec(content)) !== null) {
      files.push({ path: match[1].trim(), action: 'delete' });
    }

    return {
      files,
      summary: content.slice(0, 400),
    };
  }

  private buildSystemPrompt(): string {
    return `You are a careful coding agent. Apply the given implementation plan by returning file changes.

Rules:
- Stay inside the workspace
- Follow the plan steps and constraints exactly
- Do not invent unrelated features
- Prefer editing existing files over creating new ones unless the plan requires it
- Return complete file contents for every write

You must produce a structured list of file operations.`;
  }

  private buildUserMessage(task: AgentTask): string {
    const contextFiles = task.context.relevantFiles
      .slice(0, 12)
      .map((file) => `### ${file.path}\n\`\`\`\n${file.content}\n\`\`\``)
      .join('\n\n');

    return `${task.instructions}

## Acceptance Criteria
${task.acceptanceCriteria.map((item) => `- ${item}`).join('\n') || '- Complete the plan'}

## Relevant Files
${contextFiles || '(none)'}
`;
  }
}
