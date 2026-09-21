import * as path from 'node:path';
import type { WorkspaceManager } from './manager.js';
import type { WorkspaceSnapshot } from './types.js';
import { SnapshotManager } from '../state/snapshot.js';

const MAX_FILES = 40;
const MAX_CHARS = 120_000;

export interface ChangeMaterial {
  material: string;
  source: 'local' | 'git' | 'mixed' | 'empty';
}

/**
 * Local-first change view for review/diff.
 * 1) Filesystem fingerprint deltas (and preferred plan paths)
 * 2) Git diff as supplemental signal when available
 */
export async function buildChangeMaterial(
  workspace: WorkspaceManager,
  options?: {
    preferredPaths?: string[];
    before?: WorkspaceSnapshot;
    after?: WorkspaceSnapshot;
  },
): Promise<ChangeMaterial> {
  const after = options?.after ?? (await workspace.snapshot());
  const before = options?.before;
  const preferred = (options?.preferredPaths ?? []).map(normalizeRel).filter(Boolean);

  const localPaths = resolveLocalPaths(before, after, preferred);
  const localSection = await renderLocalFiles(workspace, localPaths);

  let gitDiff = '';
  try {
    gitDiff = (await workspace.getDiff()).trim();
  } catch {
    gitDiff = '';
  }

  if (localSection && gitDiff) {
    return {
      source: 'mixed',
      material: [
        '## Local workspace files (primary)',
        localSection,
        '',
        '## Git diff (supplemental)',
        '```diff',
        gitDiff,
        '```',
      ].join('\n'),
    };
  }

  if (localSection) {
    return {
      source: 'local',
      material: ['## Local workspace files (primary)', localSection].join('\n'),
    };
  }

  if (gitDiff) {
    return {
      source: 'git',
      material: ['## Git diff', '```diff', gitDiff, '```'].join('\n'),
    };
  }

  return {
    source: 'empty',
    material:
      'No local file changes or git diff were found. The workspace may not contain an implementation yet.',
  };
}

function normalizeRel(filePath: string): string {
  return filePath.replace(/^\.\//, '').trim();
}

function resolveLocalPaths(
  before: WorkspaceSnapshot | undefined,
  after: WorkspaceSnapshot,
  preferred: string[],
): string[] {
  const paths = new Set<string>();

  for (const file of preferred) paths.add(file);

  if (before?.fileFingerprints) {
    const snap = new SnapshotManager();
    const diff = snap.compare(before, after);
    for (const file of [...diff.filesAdded, ...diff.filesModified]) paths.add(file);
  } else {
    for (const file of Object.keys(after.fileFingerprints ?? {})) paths.add(file);
    for (const file of after.untrackedFiles) paths.add(file);
    for (const file of after.modifiedFiles) paths.add(file);
  }

  // Prefer likely app files when the set is huge
  const ranked = [...paths].sort((a, b) => scorePath(b) - scorePath(a) || a.localeCompare(b));
  return ranked.slice(0, MAX_FILES);
}

function scorePath(filePath: string): number {
  const base = path.basename(filePath).toLowerCase();
  const ext = path.extname(base);
  let score = 0;
  if (['.html', '.css', '.js', '.ts', '.tsx', '.jsx'].includes(ext)) score += 5;
  if (['index.html', 'style.css', 'styles.css', 'app.js', 'script.js', 'main.js'].includes(base))
    score += 5;
  if (filePath.includes('node_modules') || filePath.startsWith('.ai/')) score -= 20;
  return score;
}

async function renderLocalFiles(workspace: WorkspaceManager, files: string[]): Promise<string> {
  const parts: string[] = [];
  let used = 0;

  for (const relativePath of files) {
    if (used >= MAX_CHARS) {
      parts.push(`\n… truncated after ${MAX_FILES} files / ${MAX_CHARS} characters`);
      break;
    }
    try {
      if (!(await workspace.fileExists(relativePath))) continue;
      const content = await workspace.readFile(relativePath);
      const chunk = [
        '',
        `### FILE: ${relativePath}`,
        '```' + fenceLang(relativePath),
        content.length > 20_000 ? `${content.slice(0, 20_000)}\n… truncated` : content,
        '```',
      ].join('\n');
      parts.push(chunk);
      used += chunk.length;
    } catch {
      // skip unreadable
    }
  }

  return parts.join('\n').trim();
}

function fenceLang(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
      return 'html';
    case '.css':
      return 'css';
    case '.js':
    case '.mjs':
    case '.cjs':
      return 'javascript';
    case '.ts':
    case '.tsx':
      return 'typescript';
    case '.json':
      return 'json';
    case '.md':
      return 'markdown';
    default:
      return '';
  }
}
