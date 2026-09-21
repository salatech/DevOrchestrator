import { parse as parseYaml } from 'yaml';
import type { Plan, ImplementationStep } from './types.js';
import { PlanStatus } from './types.js';
import { parseImplementationSteps, parseMarkdownList } from './parser.js';

/**
 * Turn a chatbot reply (ChatGPT / Gemini / Claude) into a Plan.
 * Accepts YAML-frontmatter markdown, heading sections, or loose numbered lists.
 */
export function parseChatPlan(
  raw: string,
  request: string,
  planner: string = 'browser-chat',
): Plan {
  const content = unwrapFences(raw).trim();
  const now = new Date().toISOString().split('T')[0];
  const { title: fmTitle, id: fmId, branch: fmBranch, body } = splitFrontmatter(content);

  const objective = extractSection(body, 'Objective') || request;
  const steps = extractSteps(body);
  const title =
    fmTitle ||
    extractHeadingTitle(body) ||
    request.replace(/\s+/g, ' ').trim().slice(0, 80) ||
    'Imported plan';

  const filesToModify = extractList(body, 'Files To Modify');
  const mentioned = inferFilePaths(content);
  const filesToCreate = uniquePaths([
    ...extractList(body, 'Files To Create'),
    ...mentioned.filter((file) => !filesToModify.includes(file)),
  ]);

  const implementationSteps =
    steps.length > 0
      ? steps
      : [
          {
            number: 1,
            title: 'Implement request',
            description: body.trim() || request,
          },
        ];

  const plan: Plan = {
    id: fmId || 'PLAN-XXX',
    title,
    status: PlanStatus.AwaitingApproval,
    created: now,
    updated: now,
    planner,
    branch: fmBranch || 'unknown',
    objective,
    currentState: extractSection(body, 'Current State'),
    relevantFiles: extractList(body, 'Relevant Files'),
    filesToModify,
    filesToCreate,
    implementationSteps,
    constraints: extractList(body, 'Constraints'),
    testingStrategy:
      extractSection(body, 'Testing Strategy') || extractSection(body, 'Testing'),
    acceptanceCriteria:
      extractList(body, 'Acceptance Criteria').length > 0
        ? extractList(body, 'Acceptance Criteria')
        : ['The request is implemented'],
    risks: extractList(body, 'Risks'),
    outOfScope: extractList(body, 'Out Of Scope'),
    dependencies: extractList(body, 'Dependencies'),
  };
  return plan;
}

/** Chat/share imports must be a real plan. The API planner may keep a stub fallback. */
export function assertImportedPlan(plan: Plan, raw: string): void {
  if (looksLikeCliCommand(raw)) {
    throw new Error(
      'That file is a CLI command, not a chatbot plan. Paste Gemini’s full reply into reply.md, then run:\n  devorch plan --from reply.md',
    );
  }
  const stub =
    plan.implementationSteps.length === 1 &&
    plan.implementationSteps[0]?.title === 'Implement request';
  if (stub && plan.filesToCreate.length === 0) {
    throw new Error(
      [
        'That chat reply is not an implementation plan.',
        'Save Gemini’s full markdown reply (Objective, files, steps), then run:',
        '  devorch plan --from reply.md',
      ].join('\n'),
    );
  }
}

function looksLikeCliCommand(text: string): boolean {
  const trimmed = text.trim();
  return /^(?:devorch|npx\s+@salatech\/devorch)\b/i.test(trimmed) && !trimmed.includes('#');
}

function inferFilePaths(text: string): string[] {
  const found: string[] = [];
  const pattern =
    /(?:^|[\s`"'/(])((?:[\w.-]+\/)*[\w.-]+\.(?:html?|css|js|mjs|cjs|ts|tsx|jsx|json|py|go|rs))(?=$|[\s`"')/,])/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const file = match[1];
    if (file && !file.startsWith('.ai/') && !found.includes(file)) found.push(file);
  }
  return found;
}

function uniquePaths(files: string[]): string[] {
  return [...new Set(files.map((file) => file.trim()).filter(Boolean))];
}

export function unwrapFences(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:markdown|md|text)?\s*\n([\s\S]*?)\n```$/i);
  if (fenced) return fenced[1];
  return trimmed.replace(/^```(?:markdown|md)?\s*\n/, '').replace(/\n```\s*$/, '');
}

function splitFrontmatter(content: string): {
  title?: string;
  id?: string;
  branch?: string;
  body: string;
} {
  const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { body: content };
  let title: string | undefined;
  let id: string | undefined;
  let branch: string | undefined;
  try {
    const parsed = parseYaml(match[1]) as Record<string, unknown>;
    if (typeof parsed.title === 'string') title = parsed.title;
    if (typeof parsed.id === 'string') id = parsed.id;
    if (typeof parsed.branch === 'string') branch = parsed.branch;
  } catch {
    title = match[1].match(/title:\s*["']?(.+?)["']?\s*$/m)?.[1];
    id = match[1].match(/id:\s*(.+?)\s*$/m)?.[1]?.trim();
    branch = match[1].match(/branch:\s*(.+?)\s*$/m)?.[1]?.trim();
  }
  return { title, id, branch, body: match[2] };
}

function extractHeadingTitle(body: string): string | undefined {
  const match = body.match(/^#\s+(?!Objective\b|Current State\b|Implementation)(.+)$/m);
  return match?.[1]?.trim();
}

function extractSection(body: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `(?:^|\\n)#{1,3}\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n#\\s[^#]|$)`,
  );
  const match = body.match(regex);
  return match ? match[1].trim() : '';
}

function extractList(body: string, heading: string): string[] {
  const section = extractSection(body, heading);
  if (!section) return [];
  const bullets = parseMarkdownList(section);
  if (bullets.length > 0) return bullets;
  return section
    .split('\n')
    .map((line) => line.replace(/^\s*\d+[.)]\s+/, '').trim())
    .filter(Boolean);
}

function extractSteps(body: string): ImplementationStep[] {
  const section = extractSection(body, 'Implementation Steps') || body;
  const headingSteps = parseImplementationSteps(section);
  if (headingSteps.length > 0) return headingSteps;

  const numbered: ImplementationStep[] = [];
  let current: ImplementationStep | undefined;
  for (const line of section.split('\n')) {
    const match = line.match(/^\s*(\d+)[.)]\s+(?:\*\*)?(.+?)(?:\*\*)?\s*$/);
    if (match) {
      if (current) numbered.push(current);
      current = {
        number: parseInt(match[1], 10),
        title: match[2].trim().slice(0, 80),
        description: match[2].trim(),
      };
      continue;
    }
    if (current && line.trim()) {
      current.description = `${current.description}\n${line.trim()}`.trim();
    }
  }
  if (current) numbered.push(current);
  return numbered;
}
