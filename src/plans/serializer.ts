import { stringify as stringifyYaml } from 'yaml';
import type { Plan, PlanFrontmatter } from './types.js';

/**
 * Convert a Plan to a Markdown string with YAML frontmatter.
 * @param plan The Plan object
 * @returns Markdown string
 */
export function serializePlan(plan: Plan): string {
  const frontmatter: PlanFrontmatter = {
    id: plan.id,
    title: plan.title,
    status: plan.status,
    created: plan.created,
    updated: plan.updated,
    planner: plan.planner,
    branch: plan.branch,
  };

  const cleanFrontmatter = Object.fromEntries(
    Object.entries(frontmatter).filter(([_, v]) => v !== undefined),
  );

  let result = '---\n';
  result += stringifyYaml(cleanFrontmatter);
  result += '---\n\n';

  if (plan.objective) result += `# Objective\n${plan.objective}\n\n`;
  if (plan.currentState) result += `# Current State\n${plan.currentState}\n\n`;
  if (plan.relevantFiles?.length)
    result += `# Relevant Files\n${plan.relevantFiles.map((f) => `- ${f}`).join('\n')}\n\n`;
  if (plan.filesToModify?.length)
    result += `# Files To Modify\n${plan.filesToModify.map((f) => `- ${f}`).join('\n')}\n\n`;
  if (plan.filesToCreate?.length)
    result += `# Files To Create\n${plan.filesToCreate.map((f) => `- ${f}`).join('\n')}\n\n`;

  if (plan.implementationSteps?.length) {
    result += '# Implementation Steps\n';
    plan.implementationSteps.forEach((step, index) => {
      result += `## Step ${index + 1}: ${step.title}\n${step.description}\n\n`;
    });
  }

  if (plan.constraints?.length)
    result += `# Constraints\n${plan.constraints.map((c) => `- ${c}`).join('\n')}\n\n`;
  if (plan.testingStrategy) result += `# Testing Strategy\n${plan.testingStrategy}\n\n`;
  if (plan.acceptanceCriteria?.length)
    result += `# Acceptance Criteria\n${plan.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}\n\n`;
  if (plan.risks?.length) result += `# Risks\n${plan.risks.map((r) => `- ${r}`).join('\n')}\n\n`;
  if (plan.outOfScope?.length)
    result += `# Out Of Scope\n${plan.outOfScope.map((o) => `- ${o}`).join('\n')}\n\n`;
  if (plan.dependencies?.length)
    result += `# Dependencies\n${plan.dependencies.map((d) => `- ${d}`).join('\n')}\n\n`;

  return result.trim() + '\n';
}
