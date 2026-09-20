import * as path from 'node:path';
import type { FileContext } from './types.js';
import type { WorkspaceManager } from '../workspace/manager.js';

/**
 * Selects relevant files for a task.
 */
export class ContextSelector {
  constructor(private maxFiles: number = 30) {}

  /**
   * Select relevant files for a given request.
   * Uses heuristic-based scoring:
   * 1. Keyword matching against file paths
   * 2. Recently modified files get a bonus
   * 3. Test files associated with matched files
   * 4. Config/entry files get a small bonus
   */
  async select(
    request: string,
    allFiles: string[],
    workspace: WorkspaceManager,
    modifiedFiles: string[] = [],
  ): Promise<FileContext[]> {
    const keywords = this.extractKeywords(request);
    const scored: { path: string; score: number; reason: string }[] = [];

    for (const file of allFiles) {
      const { score, reason } = this.scoreFile(file, keywords, modifiedFiles);
      if (score > 0) {
        scored.push({ path: file, score, reason });
      }
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Take top N files
    const selected = scored.slice(0, this.maxFiles);

    // Read file contents
    const results: FileContext[] = [];
    for (const item of selected) {
      try {
        const content = await workspace.readFile(item.path);
        results.push({
          path: item.path,
          content,
          relevanceScore: Math.min(item.score, 1),
          reason: item.reason,
        });
      } catch {
        // Skip unreadable files
      }
    }

    return results;
  }

  /**
   * Score a file's relevance to the request.
   */
  private scoreFile(
    filePath: string,
    keywords: string[],
    modifiedFiles: string[],
  ): { score: number; reason: string } {
    let score = 0;
    const reasons: string[] = [];
    const lowerPath = filePath.toLowerCase();
    const fileName = path.basename(filePath).toLowerCase();

    // Keyword matching against file path
    for (const keyword of keywords) {
      if (lowerPath.includes(keyword)) {
        score += 0.3;
        reasons.push(`path matches keyword "${keyword}"`);
      }
    }

    // Recently modified files
    if (modifiedFiles.some((f) => f === filePath || filePath.endsWith(f))) {
      score += 0.2;
      reasons.push('recently modified');
    }

    // Config/entry files get a small bonus
    const configFiles = ['package.json', 'tsconfig.json', 'prisma/schema.prisma', '.env.example'];
    if (configFiles.some((cf) => lowerPath.endsWith(cf))) {
      score += 0.1;
      reasons.push('config file');
    }

    // Entry point files
    const entryFiles = ['index.ts', 'index.js', 'main.ts', 'main.js', 'app.ts', 'app.js'];
    if (entryFiles.includes(fileName)) {
      score += 0.05;
      reasons.push('entry point');
    }

    // Route/API files get a bonus for web-related keywords
    const webKeywords = [
      'api',
      'route',
      'endpoint',
      'handler',
      'controller',
      'page',
      'component',
      'middleware',
    ];
    if (
      webKeywords.some((wk) => keywords.includes(wk)) &&
      webKeywords.some((wk) => lowerPath.includes(wk))
    ) {
      score += 0.25;
      reasons.push('web-related file matches request');
    }

    // Database/model files get a bonus for data-related keywords
    const dataKeywords = [
      'database',
      'model',
      'schema',
      'migration',
      'seed',
      'prisma',
      'db',
      'table',
    ];
    if (
      dataKeywords.some((dk) => keywords.includes(dk)) &&
      dataKeywords.some((dk) => lowerPath.includes(dk))
    ) {
      score += 0.25;
      reasons.push('data-related file matches request');
    }

    // Auth files get a bonus for auth-related keywords
    const authKeywords = [
      'auth',
      'login',
      'session',
      'jwt',
      'oauth',
      'token',
      'password',
      'signup',
      'register',
    ];
    if (
      authKeywords.some((ak) => keywords.includes(ak)) &&
      authKeywords.some((ak) => lowerPath.includes(ak))
    ) {
      score += 0.25;
      reasons.push('auth-related file matches request');
    }

    // Test file associated with a matched source file
    if (
      score > 0 &&
      (lowerPath.includes('.test.') ||
        lowerPath.includes('.spec.') ||
        lowerPath.includes('__tests__'))
    ) {
      score += 0.1;
      reasons.push('test file for relevant source');
    }

    return {
      score,
      reason: reasons.join('; ') || 'no match',
    };
  }

  /**
   * Extract keywords from a natural language request.
   * Simple tokenization: lowercase, split on non-alphanumeric, filter stop words and short words.
   */
  private extractKeywords(request: string): string[] {
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'shall',
      'can',
      'need',
      'must',
      'to',
      'of',
      'in',
      'for',
      'on',
      'with',
      'at',
      'by',
      'from',
      'as',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'and',
      'but',
      'or',
      'nor',
      'not',
      'so',
      'yet',
      'both',
      'either',
      'each',
      'every',
      'all',
      'any',
      'few',
      'more',
      'most',
      'other',
      'some',
      'such',
      'no',
      'only',
      'own',
      'same',
      'than',
      'too',
      'very',
      'just',
      'because',
      'if',
      'when',
      'where',
      'how',
      'what',
      'which',
      'who',
      'whom',
      'this',
      'that',
      'these',
      'those',
      'i',
      'me',
      'my',
      'we',
      'our',
      'you',
      'your',
      'he',
      'she',
      'it',
      'they',
      'them',
      'add',
      'create',
      'make',
      'build',
      'implement',
      'fix',
      'update',
      'change',
      'modify',
      'remove',
      'delete',
      'use',
      'using',
      'existing',
    ]);

    const words = request
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    const keywords = words.filter((w) => w.length > 2 && !stopWords.has(w));
    return [...new Set(keywords)];
  }
}
