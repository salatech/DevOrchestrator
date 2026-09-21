import type { PlannerAgent } from './interfaces.js';
import type { AgentCapabilities } from './types.js';
import type { Plan } from '../plans/types.js';
import type { TaskContext } from '../context/types.js';
import type { ModelOrchestrator } from '../providers/orchestrator.js';
import { parseChatPlan } from '../plans/from-chat.js';

/**
 * LLM-based planner agent.
 */
export class LLMPlannerAgent implements PlannerAgent {
  readonly id = 'llm-planner';
  readonly name = 'LLM Planner';
  readonly capabilities: AgentCapabilities = {
    planning: true,
    coding: false,
    reviewing: false,
    terminal: false,
    filesystem: false,
  };

  constructor(private modelOrchestrator: ModelOrchestrator) {}

  /**
   * Create an implementation plan based on request and context.
   */
  async createPlan(request: string, context: TaskContext): Promise<Plan> {
    const systemPrompt = this.buildSystemPrompt(context);
    const userMessage = this.buildUserMessage(request, context);

    const response = await this.modelOrchestrator.generate('planner', {
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.3,
    });

    return parseChatPlan(response.content, request, 'llm');
  }

  private buildSystemPrompt(context: TaskContext): string {
    let prompt = `You are an expert software architect and technical planner. Your job is to create detailed, actionable implementation plans.

You must output a plan in the following Markdown format with YAML frontmatter:

---
id: (leave as PLAN-XXX, will be assigned)
title: "Short descriptive title"
status: draft
created: ${new Date().toISOString().split('T')[0]}
planner: llm
branch: (current branch)
---

# Objective
Clear description of what this plan achieves.

# Current State
Relevant current state of the codebase.

# Relevant Files
- path/to/file1
- path/to/file2

# Files To Modify
- path/to/file1

# Files To Create
- path/to/new-file

# Implementation Steps

## Step 1: Title
Detailed description of what to do.

## Step 2: Title
Detailed description.

# Constraints
- Constraint 1
- Constraint 2

# Testing Strategy
How to verify the implementation works.

# Acceptance Criteria
- Criterion 1
- Criterion 2

# Risks
- Risk 1

# Out Of Scope
- Item 1

# Dependencies
- Dependency 1

IMPORTANT RULES:
- Be specific about file paths and code changes
- Include concrete implementation steps, not vague instructions
- Identify risks and constraints
- Define clear acceptance criteria
- Do not invent requirements not in the request
- If the request is ambiguous, note it in the plan rather than guessing`;

    if (context.project) {
      prompt += `\n\n## Project Context\n${context.project}`;
    }
    if (context.architecture) {
      prompt += `\n\n## Architecture\n${context.architecture}`;
    }
    if (context.conventions) {
      prompt += `\n\n## Conventions\n${context.conventions}`;
    }

    return prompt;
  }

  private buildUserMessage(request: string, context: TaskContext): string {
    let message = `Create an implementation plan for the following request:\n\n"${request}"\n`;

    // Add git state
    message += `\n## Current Git State\n`;
    message += `Branch: ${context.gitState.branch}\n`;
    message += `Modified files: ${context.gitState.modifiedFiles.join(', ') || 'none'}\n`;

    // Add relevant files
    if (context.relevantFiles.length > 0) {
      message += `\n## Relevant Source Files\n`;
      for (const file of context.relevantFiles) {
        message += `\n### ${file.path}\n\`\`\`\n${file.content}\n\`\`\`\n`;
      }
    }

    // Add skills
    if (context.skills.length > 0) {
      message += `\n## Applicable Skills\n`;
      for (const skill of context.skills) {
        message += `\n### ${skill.name}\n${skill.content}\n`;
      }
    }

    // Add package info
    if (context.packageInfo) {
      message += `\n## Package Info\n`;
      message += `Name: ${context.packageInfo.name}\n`;
      message += `Dependencies: ${Object.keys(context.packageInfo.dependencies).join(', ')}\n`;
    }

    return message;
  }
}
