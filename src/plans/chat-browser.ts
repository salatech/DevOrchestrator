import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { execa } from 'execa';
import type { TaskContext } from '../context/types.js';

export type ChatSourceId = 'chatgpt' | 'gemini' | 'claude';

export interface ChatSource {
  id: ChatSourceId;
  label: string;
  url: string;
}

export const CHAT_SOURCES: Record<ChatSourceId, ChatSource> = {
  chatgpt: { id: 'chatgpt', label: 'ChatGPT', url: 'https://chatgpt.com/' },
  gemini: { id: 'gemini', label: 'Gemini', url: 'https://gemini.google.com/app' },
  claude: { id: 'claude', label: 'Claude', url: 'https://claude.ai/new' },
};

export function resolveChatSource(value: unknown): ChatSource | undefined {
  if (value === true || value === '' || value === 'true') return undefined;
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!raw) return undefined;
  if (raw === 'openai' || raw === 'gpt' || raw === 'chatgpt') return CHAT_SOURCES.chatgpt;
  if (raw === 'google' || raw === 'gemini' || raw === 'bard') return CHAT_SOURCES.gemini;
  if (raw === 'anthropic' || raw === 'claude') return CHAT_SOURCES.claude;
  return undefined;
}

export function inboxDir(projectRoot: string): string {
  return path.join(projectRoot, '.ai', 'inbox');
}

export function inboxPlanPath(projectRoot: string): string {
  return path.join(inboxDir(projectRoot), 'plan.md');
}

export function inboxPromptPath(projectRoot: string): string {
  return path.join(inboxDir(projectRoot), 'planning-prompt.md');
}

export function buildBrowserPlanningPrompt(request: string, context: TaskContext): string {
  const files = context.relevantFiles.slice(0, 8);
  let prompt = `You are planning software work for a local project. Do NOT write the full source yet.
Write an implementation PLAN I can import into DevOrchestrator.

Request:
${request}

Reply in this exact Markdown shape (no extra chatter before/after):

---
title: "Short title"
---

# Objective
...

# Current State
...

# Files To Create
- path/file.html

# Files To Modify
- path/existing.js

# Implementation Steps

## Step 1: Title
What to do, in enough detail for a coding agent.

## Step 2: Title
...

# Acceptance Criteria
- ...

# Constraints
- Stay in this project folder
- Do not invent unrelated features
`;

  if (context.project) prompt += `\n# Project notes\n${context.project.slice(0, 4000)}\n`;
  if (context.gitState.branch) prompt += `\nGit branch: ${context.gitState.branch}\n`;

  if (files.length > 0) {
    prompt += `\n# Existing files (local, truncated)\n`;
    for (const file of files) {
      const snippet = file.content.length > 2500 ? `${file.content.slice(0, 2500)}\n…` : file.content;
      prompt += `\n### ${file.path}\n\`\`\`\n${snippet}\n\`\`\`\n`;
    }
  }

  return prompt.trim() + '\n';
}

export async function writeInboxFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (process.platform === 'darwin') {
      await execa('pbcopy', { input: text });
      return true;
    }
    if (process.platform === 'win32') {
      await execa('clip', { input: text });
      return true;
    }
    await execa('xclip', ['-selection', 'clipboard'], { input: text });
    return true;
  } catch {
    return false;
  }
}

export async function readClipboard(): Promise<string> {
  try {
    if (process.platform === 'darwin') {
      const { stdout } = await execa('pbpaste');
      return stdout;
    }
    if (process.platform === 'win32') {
      const { stdout } = await execa('powershell', ['-NoProfile', '-Command', 'Get-Clipboard']);
      return stdout;
    }
    const { stdout } = await execa('xclip', ['-selection', 'clipboard', '-o']);
    return stdout;
  } catch {
    return '';
  }
}

export async function openInBrowser(url: string): Promise<void> {
  if (process.platform === 'darwin') {
    await execa('open', [url]);
    return;
  }
  if (process.platform === 'win32') {
    await execa('cmd', ['/c', 'start', '', url]);
    return;
  }
  await execa('xdg-open', [url]);
}

export async function readPlanReply(
  projectRoot: string,
  typedPath?: string,
): Promise<string | undefined> {
  const requested = typedPath?.trim();
  if (requested) {
    const resolved = path.isAbsolute(requested)
      ? requested
      : path.resolve(projectRoot, requested);
    try {
      const content = await fs.readFile(resolved, 'utf8');
      if (content.trim().length < 20) {
        throw new Error(
          `${requested} is too short to be a plan. Paste the chatbot’s full reply into that file.`,
        );
      }
      return content;
    } catch (error) {
      if (error instanceof Error && error.message.includes('too short')) throw error;
      throw new Error(
        `Could not read ${requested} (${resolved}). Save the chatbot reply to that file first.`,
      );
    }
  }

  try {
    const inbox = await fs.readFile(inboxPlanPath(projectRoot), 'utf8');
    if (inbox.trim().length > 20) return inbox;
  } catch {
    // fall through to clipboard
  }

  const clip = await readClipboard();
  if (clip.trim().length > 20) return clip;
  return undefined;
}
