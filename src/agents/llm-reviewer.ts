import type { ReviewerAgent } from './interfaces.js';
import type { AgentCapabilities, ReviewResult, Finding } from './types.js';
import type { Plan } from '../plans/types.js';
import type { TaskContext } from '../context/types.js';
import type { ModelOrchestrator } from '../providers/orchestrator.js';
import { z } from 'zod';
import { ExecutionError } from '../errors/index.js';

const ReviewResultSchema = z.object({
  status: z.enum(['approved', 'changes_requested']),
  summary: z.string(),
  findings: z.array(z.object({
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    file: z.string().optional(),
    line: z.number().optional(),
    description: z.string(),
    recommendation: z.string(),
  })),
});

/**
 * LLM-based reviewer agent.
 */
export class LLMReviewerAgent implements ReviewerAgent {
  readonly id = 'llm-reviewer';
  readonly name = 'LLM Reviewer';
  readonly capabilities: AgentCapabilities = {
    planning: false,
    coding: false,
    reviewing: true,
    terminal: false,
    filesystem: false,
  };

  constructor(private modelOrchestrator: ModelOrchestrator) {}

  /**
   * Review code against plan and criteria.
   */
  async review(
    plan: Plan,
    diff: string,
    testResults: string,
    context: TaskContext,
  ): Promise<ReviewResult> {
    const systemPrompt = this.buildSystemPrompt(context);
    const userMessage = this.buildUserMessage(plan, diff, testResults);
    
    try {
      const { object } = await this.modelOrchestrator.generateStructured(
        'reviewer',
        {
          systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
          temperature: 0.2,
        },
        ReviewResultSchema
      );
      
      return {
        status: object.status,
        summary: object.summary,
        findings: object.findings as Finding[],
      };
    } catch (error) {
      // Fallback
      const response = await this.modelOrchestrator.generate('reviewer', {
        systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        temperature: 0.2,
      });
      
      return this.parseReviewFallback(response.content);
    }
  }

  private buildSystemPrompt(context: TaskContext): string {
    let prompt = `You are an expert code reviewer. Review the provided implementation diff against the plan's requirements and acceptance criteria.
Evaluate for correctness, style, and potential bugs.

Provide your feedback in a structured format containing:
1. Status: either 'approved' or 'changes_requested'
2. Summary: A brief summary of your review
3. Findings: A list of specific issues found, with severity, file, and recommendation.`;

    if (context.conventions) {
      prompt += `\n\n## Project Conventions\nEnsure the code adheres to these conventions:\n${context.conventions}`;
    }

    return prompt;
  }

  private buildUserMessage(plan: Plan, diff: string, testResults: string): string {
    return `Review the following implementation:

## Plan Objective
${plan.objective}

## Acceptance Criteria
${plan.acceptanceCriteria.map(c => `- ${c}`).join('\n')}

## Code Diff
\`\`\`diff
${diff}
\`\`\`

## Test Results
\`\`\`
${testResults || 'No tests run.'}
\`\`\`
`;
  }

  private parseReviewFallback(content: string): ReviewResult {
    // Very basic fallback
    const status = content.toLowerCase().includes('approved') ? 'approved' : 'changes_requested';
    return {
      status,
      summary: content.substring(0, 500) + '... (parsed from unstructured response)',
      findings: [],
    };
  }
}
