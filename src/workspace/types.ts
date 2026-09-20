/** Detected project type */
export type ProjectType =
  'nodejs' | 'python' | 'rust' | 'go' | 'java' | 'dotnet' | 'ruby' | 'unknown';

/** Detected package manager */
export type PackageManager =
  | 'npm'
  | 'pnpm'
  | 'yarn'
  | 'bun'
  | 'pip'
  | 'cargo'
  | 'go'
  | 'maven'
  | 'gradle'
  | 'bundler'
  | 'unknown';

/** Detected programming language */
export type Language =
  'typescript' | 'javascript' | 'python' | 'rust' | 'go' | 'java' | 'csharp' | 'ruby' | 'unknown';

/** Detected framework */
export type Framework =
  | 'nextjs'
  | 'react'
  | 'vue'
  | 'nuxt'
  | 'svelte'
  | 'sveltekit'
  | 'express'
  | 'fastify'
  | 'nestjs'
  | 'django'
  | 'flask'
  | 'fastapi'
  | 'rails'
  | 'spring'
  | 'none';

/** Complete workspace information */
export interface WorkspaceInfo {
  /** Absolute path to the project root */
  root: string;
  /** Detected project type */
  projectType: ProjectType;
  /** Detected package manager */
  packageManager: PackageManager;
  /** Detected programming languages */
  languages: Language[];
  /** Detected frameworks */
  frameworks: Framework[];
  /** Whether the project has git initialized */
  hasGit: boolean;
  /** Whether the project has an .ai/ directory */
  hasAIDir: boolean;
}

/** Git commit information */
export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
}

/** Current git state */
export interface GitState {
  branch: string;
  head: string;
  isDirty: boolean;
  modifiedFiles: string[];
  stagedFiles: string[];
  untrackedFiles: string[];
  deletedFiles: string[];
  recentCommits: CommitInfo[];
}

/** Lightweight snapshot of workspace state */
export interface WorkspaceSnapshot {
  branch: string;
  head: string;
  modifiedFiles: string[];
  untrackedFiles: string[];
  deletedFiles: string[];
  timestamp: string;
}

/** Package/dependency information */
export interface PackageInfo {
  name: string;
  version: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
}

/** Options for listing files */
export interface ListFilesOptions {
  /** Maximum depth for recursive listing */
  maxDepth?: number;
  /** Glob patterns to include */
  include?: string[];
  /** Glob patterns to exclude */
  exclude?: string[];
  /** Whether to respect .gitignore */
  respectGitignore?: boolean;
}

/** File information */
export interface FileInfo {
  /** Relative path from project root */
  path: string;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** File size in bytes (undefined for directories) */
  size?: number;
  /** Last modified timestamp */
  modifiedAt?: string;
}
