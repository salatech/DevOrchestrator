import type { GitState, PackageInfo } from '../workspace/types.js';
import type { PlanSummary } from '../plans/types.js';

/** A source file with relevance information */
export interface FileContext {
  /** Relative path from project root */
  path: string;
  /** File content */
  content: string;
  /** Relevance score (0-1) */
  relevanceScore: number;
  /** Why this file was selected */
  reason: string;
}

/** Skill context information */
export interface SkillContext {
  /** Skill name */
  name: string;
  /** Skill content (full SKILL.md) */
  content: string;
  /** Relevance score (0-1) */
  relevanceScore: number;
}

/** Complete task context assembled for the LLM */
export interface TaskContext {
  /** PROJECT.md content */
  project: string;
  /** ARCHITECTURE.md content */
  architecture: string;
  /** CONVENTIONS.md content */
  conventions: string;
  /** Matched skills */
  skills: SkillContext[];
  /** Selected relevant source files */
  relevantFiles: FileContext[];
  /** Current git state */
  gitState: GitState;
  /** Existing plans summary */
  existingPlans: PlanSummary[];
  /** Package/dependency information */
  packageInfo: PackageInfo | null;
}

/** Raw collected context before selection */
export interface CollectedContext {
  project: string;
  architecture: string;
  conventions: string;
  skills: SkillContext[];
  allFiles: string[];
  gitState: GitState;
  existingPlans: PlanSummary[];
  packageInfo: PackageInfo | null;
}

/** Options for context building */
export interface ContextOptions {
  /** Maximum number of files to include */
  maxFiles?: number;
  /** Additional file paths to always include */
  includeFiles?: string[];
  /** Whether to include git state */
  includeGitState?: boolean;
}
