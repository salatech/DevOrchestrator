import type { PlannerAgent } from './interfaces.js';
import type { AgentCapabilities } from './types.js';
import type { Plan } from '../plans/types.js';
import { PlanStatus } from '../plans/types.js';
import type { TaskContext } from '../context/types.js';
import type { ModelOrchestrator } from '../providers/orchestrator.js';
import { PlanningError } from '../errors/index.js';
import { parse as parseYaml } from 'yaml';

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

    return this.parseResponse(response.content, request);
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

  private parseResponse(content: string, request: string): Plan {
    try {
      return this.parsePlanContent(content, request);
    } catch {
      return this.createFallbackPlan(content, request);
    }
  }

  private parsePlanContent(content: string, request: string): Plan {
    // Simple frontmatter parsing
    const fmMatch = content.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)$/);

    const now = new Date().toISOString().split('T')[0];
    let id = 'PLAN-XXX';
    let title = request.substring(0, 80);
    let branch = 'unknown';

    if (fmMatch) {
      try {
        const fmContent = fmMatch[1];
        const parsedFm = parseYaml(fmContent);
        if (parsedFm.title) title = parsedFm.title;
        if (parsedFm.id) id = parsedFm.id;
        if (parsedFm.branch) branch = parsedFm.branch;
      } catch {
        // Fallback to manual parsing if yaml parsing fails
        const fmContent = fmMatch[1];
        const titleMatch = fmContent.match(/title:\s*["']?(.+?)["']?\s*$/m);
        const idMatch = fmContent.match(/id:\s*(.+?)\s*$/m);
        const branchMatch = fmContent.match(/branch:\s*(.+?)\s*$/m);

        if (titleMatch) title = titleMatch[1];
        if (idMatch) id = idMatch[1];
        if (branchMatch) branch = branchMatch[1];
      }
    }

    // Parse sections from body
    const body = fmMatch ? fmMatch[2] : content;

    return {
      id,
      title,
      status: PlanStatus.Draft,
      created: now,
      updated: now,
      planner: 'llm',
      branch,
      objective: this.extractSection(body, 'Objective'),
      currentState: this.extractSection(body, 'Current State'),
      relevantFiles: this.extractList(body, 'Relevant Files'),
      filesToModify: this.extractList(body, 'Files To Modify'),
      filesToCreate: this.extractList(body, 'Files To Create'),
      implementationSteps: this.extractSteps(body),
      constraints: this.extractList(body, 'Constraints'),
      testingStrategy:
        this.extractSection(body, 'Testing Strategy') || this.extractSection(body, 'Testing'),
      acceptanceCriteria: this.extractList(body, 'Acceptance Criteria'),
      risks: this.extractList(body, 'Risks'),
      outOfScope: this.extractList(body, 'Out Of Scope'),
      dependencies: this.extractList(body, 'Dependencies'),
    };
  }

  private createFallbackPlan(content: string, request: string): Plan {
    const now = new Date().toISOString().split('T')[0];
    return {
      id: 'PLAN-XXX',
      title: request.substring(0, 80),
      status: PlanStatus.Draft,
      created: now,
      updated: now,
      planner: 'llm',
      branch: 'unknown',
      objective: request,
      currentState: '',
      relevantFiles: [],
      filesToModify: [],
      filesToCreate: [],
      implementationSteps: [
        { number: 1, title: 'Implementation', description: content || request },
      ],
      constraints: [],
      testingStrategy: '',
      acceptanceCriteria: ['The request is implemented', 'Existing tests still pass'],
      risks: [],
      outOfScope: [],
      dependencies: [],
    };
  }

  // Helper to extract a section by heading
  private extractSection(body: string, heading: string): string {
    const regex = new RegExp(`^#\\s+${heading}\\s*$([\\s\\S]*?)(?=^#\\s|$)`, 'mi');
    const match = body.match(regex);
    return match ? match[1].trim() : '';
  }

  // Helper to extract a bullet list from a section
  private extractList(body: string, heading: string): string[] {
    const section = this.extractSection(body, heading);
    if (!section) return [];
    return section
      .split('\n')
      .map((line) => line.replace(/^\s*[-*]\s*/, '').trim())
      .filter((line) => line.length > 0);
  }

  // Helper to extract implementation steps
  private extractSteps(
    body: string,
  ): { number: number; title: string; description: string; files?: string[] }[] {
    const stepsSection = this.extractSection(body, 'Implementation Steps');
    if (!stepsSection) return [];

    const stepRegex = /^##\s+Step\s+(\d+)(?::\s*(.+))?\s*$/gm;
    const steps: { number: number; title: string; description: string }[] = [];
    let match: RegExpExecArray | null;
    const positions: { index: number; number: number; title: string }[] = [];

    while ((match = stepRegex.exec(stepsSection)) !== null) {
      positions.push({
        index: match.index + match[0].length,
        number: parseInt(match[1], 10),
        title: match[2]?.trim() || `Step ${match[1]}`,
      });
    }

    for (let i = 0; i < positions.length; i++) {
      const start = positions[i].index;
      const end =
        i + 1 < positions.length
          ? positions[i + 1].index - (positions[i + 1].title.length + 20)
          : stepsSection.length;
      const description = stepsSection.substring(start, end).trim();
      steps.push({
        number: positions[i].number,
        title: positions[i].title,
        description,
      });
    }

    return steps;
  }
}
