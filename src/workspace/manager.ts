import * as path from 'node:path';
import type { WorkspaceInfo, GitState, WorkspaceSnapshot, PackageInfo } from './types.js';
import * as filesystem from './filesystem.js';
import { GitManager } from './git.js';
import { detectProjectType, detectPackageManager, detectLanguages, detectFrameworks, readPackageInfo } from './detector.js';
import { WorkspaceError } from '../errors/index.js';

/**
 * Main facade for interacting with a workspace
 */
export class WorkspaceManager {
  private gitManager: GitManager;

  /**
   * Initializes the WorkspaceManager
   * @param root The root directory of the workspace
   */
  constructor(private root: string) {
    this.root = path.resolve(root);
    this.gitManager = new GitManager(this.root);
  }

  /**
   * Ascends the directory tree to find the true project root (looking for .git or package.json)
   * Falls back to the starting directory if no obvious root is found.
   */
  static async findProjectRoot(startDir: string): Promise<string> {
    let currentDir = path.resolve(startDir);
    const { root } = path.parse(currentDir);

    while (currentDir !== root) {
      const gitExists = await filesystem.pathExists(path.join(currentDir, '.git'));
      const pkgExists = await filesystem.fileExists(path.join(currentDir, 'package.json'));
      
      if (gitExists || pkgExists) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
    
    // Fallback to startDir if no root markers found
    return path.resolve(startDir);
  }

  /** 
   * Get the workspace root path 
   * @returns Absolute path to workspace root
   */
  getRoot(): string {
    return this.root;
  }

  /** 
   * Inspect the workspace and return comprehensive info 
   * @returns Comprehensive workspace information
   */
  async inspect(): Promise<WorkspaceInfo> {
    try {
      const [type, packageManager, languages, frameworks, packageInfo] = await Promise.all([
        detectProjectType(this.root),
        detectPackageManager(this.root),
        detectLanguages(this.root),
        detectFrameworks(this.root),
        readPackageInfo(this.root)
      ]);

      return {
        root: this.root,
        projectType: type,
        packageManager,
        languages,
        frameworks,
        hasGit: await this.gitManager.isGitRepo(),
        hasAIDir: await this.fileExists('.ai'),
      };
    } catch (error: any) {
      throw new WorkspaceError(`Failed to inspect workspace: ${error.message}`);
    }
  }

  /** 
   * Get current git state 
   * @returns Current git state
   */
  async getGitState(): Promise<GitState> {
    return this.gitManager.getState();
  }

  /** 
   * Create a workspace snapshot 
   * @returns Snapshot of the workspace
   */
  async snapshot(): Promise<WorkspaceSnapshot> {
    try {
      const gitState = await this.getGitState();
      return {
        timestamp: new Date().toISOString(),
        branch: gitState.branch,
        head: gitState.head,
        modifiedFiles: gitState.modifiedFiles,
        untrackedFiles: gitState.untrackedFiles,
      };
    } catch (error: any) {
      throw new WorkspaceError(`Failed to create workspace snapshot: ${error.message}`);
    }
  }

  /** 
   * Read a file relative to workspace root 
   * @param relativePath Path relative to root
   * @returns File content as string
   */
  async readFile(relativePath: string): Promise<string> {
    const safePath = filesystem.enforceSafePath(this.root, relativePath);
    return filesystem.readFile(safePath);
  }

  /** 
   * Write a file relative to workspace root 
   * @param relativePath Path relative to root
   * @param content Content to write
   */
  async writeFile(relativePath: string, content: string): Promise<void> {
    const safePath = filesystem.enforceSafePath(this.root, relativePath);
    return filesystem.writeFile(safePath, content);
  }

  /** 
   * Check if a file exists relative to workspace root 
   * @param relativePath Path relative to root
   * @returns true if file exists
   */
  async fileExists(relativePath: string): Promise<boolean> {
    const safePath = filesystem.enforceSafePath(this.root, relativePath);
    return filesystem.fileExists(safePath);
  }

  /** 
   * List all source files in the workspace 
   * @returns Array of relative file paths
   */
  async listSourceFiles(): Promise<string[]> {
    return filesystem.listFiles(this.root);
  }

  /** 
   * Get package info 
   * @returns Parsed package info or null
   */
  async getPackageInfo(): Promise<PackageInfo | null> {
    return readPackageInfo(this.root);
  }

  /** 
   * Get git diff 
   * @param staged true to get staged diff, false for unstaged
   * @returns Diff output string
   */
  async getDiff(staged: boolean = false): Promise<string> {
    return this.gitManager.getDiff(staged);
  }

  /** 
   * Get diff statistics 
   * @returns Object containing diff statistics
   */
  async getDiffStats(): Promise<{ filesChanged: number; insertions: number; deletions: number }> {
    return this.gitManager.getDiffStats();
  }
}
