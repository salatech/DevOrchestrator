import { parse as parseYaml } from 'yaml';
import type { Plan, PlanFrontmatter, PlanStatus, ImplementationStep } from './types.js';
import { PlanningError } from '../errors/index.js';

/**
 * Split YAML frontmatter from markdown body.
 * @param content The markdown content
 * @returns Object with parsed frontmatter and body
 */
export function parseFrontmatter<T = Record<string, unknown>>(
  content: string,
): { data: T; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { data: {} as T, body: content };
  }

  try {
    const data = parseYaml(match[1]) as T;
    return { data, body: match[2] };
  } catch (error) {
    throw new PlanningError(`Invalid frontmatter: ${(error as Error).message}`);
  }
}

/**
 * Extract items from a markdown bullet list.
 * @param section The markdown section
 * @returns Array of list items
 */
export function parseMarkdownList(section: string): string[] {
  const items: string[] = [];
  const lines = section.split('\n');
  for (const line of lines) {
    const match = line.match(/^[\s]*[-*]\s+(.+)$/);
    if (match) {
      items.push(match[1].trim());
    }
  }
  return items;
}

/**
 * Extract numbered steps from a section.
 * @param section The markdown section
 * @returns Array of implementation steps
 */
export function parseImplementationSteps(section: string): ImplementationStep[] {
  const steps: ImplementationStep[] = [];
  const stepRegex = /^##\s*Step\s*(\d+)(?::\s*(.+))?$/gm;
  let currentStep: ImplementationStep | null = null;

  const lines = section.split('\n');
  let currentDescription: string[] = [];

  for (const line of lines) {
    const stepMatch = line.match(/^##\s*Step\s*(\d+)(?::\s*(.+))?$/);
    if (stepMatch) {
      if (currentStep) {
        currentStep.description = currentDescription.join('\n').trim();
        steps.push(currentStep);
      }
      currentStep = {
        number: parseInt(stepMatch[1], 10),
        title: stepMatch[2]?.trim() || `Step ${stepMatch[1]}`,
        description: '',
      } as any;
      currentDescription = [];
    } else if (currentStep) {
      currentDescription.push(line);
    }
  }

  if (currentStep) {
    currentStep.description = currentDescription.join('\n').trim();
    steps.push(currentStep);
  }

  return steps;
}

const PLAN_SECTIONS = new Set([
  'objective',
  'current state',
  'relevant files',
  'files to modify',
  'files to create',
  'implementation steps',
  'constraints',
  'testing strategy',
  'testing',
  'acceptance criteria',
  'risks',
  'out of scope',
  'dependencies',
]);

/**
 * Parse a complete plan file.
 * @param content The file content
 * @returns Parsed Plan object
 */
export function parsePlanFile(content: string): Plan {
  const { data: frontmatter, body } = parseFrontmatter<PlanFrontmatter>(content);

  if (!frontmatter.id || !frontmatter.title || !frontmatter.status) {
    throw new PlanningError('Missing required frontmatter fields (id, title, status)');
  }

  const sections = new Map<string, string>();
  let lastHeading = '';

  const lines = body.split('\n');
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,2})\s+(.+)$/);
    const headingName = headingMatch?.[2]?.trim() ?? '';
    const isPlanSection =
      headingMatch !== null &&
      (headingMatch[1] === '#' || PLAN_SECTIONS.has(headingName.toLowerCase()));

    if (isPlanSection && headingMatch) {
      if (lastHeading) {
        sections.set(lastHeading.toLowerCase(), currentContent.join('\n').trim());
      }
      lastHeading = headingName;
      currentContent = [];
    } else if (lastHeading) {
      currentContent.push(line);
    }
  }

  if (lastHeading) {
    sections.set(lastHeading.toLowerCase(), currentContent.join('\n').trim());
  }

  return {
    id: frontmatter.id,
    title: frontmatter.title,
    status: frontmatter.status as PlanStatus,
    created: frontmatter.created || new Date().toISOString(),
    updated: frontmatter.updated || new Date().toISOString(),
    planner: frontmatter.planner,
    branch: frontmatter.branch,
    objective: sections.get('objective') || '',
    currentState: sections.get('current state') || '',
    relevantFiles: parseMarkdownList(sections.get('relevant files') || ''),
    filesToModify: parseMarkdownList(sections.get('files to modify') || ''),
    filesToCreate: parseMarkdownList(sections.get('files to create') || ''),
    implementationSteps: parseImplementationSteps(sections.get('implementation steps') || ''),
    constraints: parseMarkdownList(sections.get('constraints') || ''),
    testingStrategy: sections.get('testing strategy') || sections.get('testing') || '',
    acceptanceCriteria: parseMarkdownList(sections.get('acceptance criteria') || ''),
    risks: parseMarkdownList(sections.get('risks') || ''),
    outOfScope: parseMarkdownList(sections.get('out of scope') || ''),
    dependencies: parseMarkdownList(sections.get('dependencies') || ''),
  };
}
