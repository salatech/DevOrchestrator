import simpleGit, { type SimpleGit } from 'simple-git';
import type { GitState, CommitInfo } from './types.js';
import { WorkspaceError } from '../errors/index.js';

/**
 * GitManager class to handle git operations
 */
export class GitManager {
  private git: SimpleGit;

  /**
   * Initializes the GitManager
   * @param root The root directory of the workspace
   */
  constructor(private root: string) {
    this.git = simpleGit(root);
  }

  /** 
   * Check if current directory is a git repo 
   * @returns true if the directory is a git repository
   */
  async isGitRepo(): Promise<boolean> {
    try {
      return await this.git.checkIsRepo();
    } catch {
      return false;
    }
  }

  /** 
   * Get comprehensive git state 
   * @returns GitState object containing current git state
   */
  async getState(): Promise<GitState> {
    try {
      const [isRepo, branch, head, modifiedFiles, stagedFiles, untrackedFiles] = await Promise.all([
        this.isGitRepo(),
        this.getBranch().catch(() => ''),
        this.getHead().catch(() => ''),
        this.getModifiedFiles().catch(() => []),
        this.getStagedFiles().catch(() => []),
        this.getUntrackedFiles().catch(() => [])
      ]);

      return {
        branch,
        head,
        modifiedFiles,
        stagedFiles,
        untrackedFiles,
        isDirty: modifiedFiles.length > 0 || stagedFiles.length > 0 || untrackedFiles.length > 0,
        recentCommits: await this.getLog(5).catch(() => []),
      };
    } catch (error: any) {
      throw new WorkspaceError(`Failed to get git state: ${error.message}`);
    }
  }

  /** 
   * Get current branch name 
   * @returns Current branch name
   */
  async getBranch(): Promise<string> {
    try {
      const branchSummary = await this.git.branch();
      return branchSummary.current;
    } catch (error: any) {
      throw new WorkspaceError(`Failed to get current branch: ${error.message}`);
    }
  }

  /** 
   * Get HEAD commit hash 
   * @returns HEAD commit hash
   */
  async getHead(): Promise<string> {
    try {
      const log = await this.git.log({ maxCount: 1 });
      return log.latest ? log.latest.hash : '';
    } catch (error: any) {
      throw new WorkspaceError(`Failed to get HEAD: ${error.message}`);
    }
  }

  /** 
   * Get git diff output 
   * @param staged true to get staged diff, false for unstaged
   * @returns Diff output string
   */
  async getDiff(staged: boolean = false): Promise<string> {
    try {
      return staged ? await this.git.diff(['--staged']) : await this.git.diff();
    } catch (error: any) {
      throw new WorkspaceError(`Failed to get diff: ${error.message}`);
    }
  }

  /** 
   * Get diff statistics 
   * @returns Object containing diff statistics
   */
  async getDiffStats(): Promise<{ filesChanged: number; insertions: number; deletions: number }> {
    try {
      const diffSummary = await this.git.diffSummary();
      return {
        filesChanged: diffSummary.changed,
        insertions: diffSummary.insertions,
        deletions: diffSummary.deletions
      };
    } catch (error: any) {
      throw new WorkspaceError(`Failed to get diff stats: ${error.message}`);
    }
  }

  /** 
   * Get recent commit log 
   * @param limit Number of commits to retrieve (default: 10)
   * @returns Array of CommitInfo objects
   */
  async getLog(limit: number = 10): Promise<CommitInfo[]> {
    try {
      const log = await this.git.log({ maxCount: limit });
      return log.all.map(commit => ({
        hash: commit.hash,
        author: commit.author_name,
        message: commit.message,
        date: commit.date
      }));
    } catch (error: any) {
      throw new WorkspaceError(`Failed to get commit log: ${error.message}`);
    }
  }

  /** 
   * Get list of modified files 
   * @returns Array of modified file paths
   */
  async getModifiedFiles(): Promise<string[]> {
    try {
      const status = await this.git.status();
      return status.modified;
    } catch (error: any) {
      throw new WorkspaceError(`Failed to get modified files: ${error.message}`);
    }
  }

  /** 
   * Get list of staged files 
   * @returns Array of staged file paths
   */
  async getStagedFiles(): Promise<string[]> {
    try {
      const status = await this.git.status();
      return status.staged;
    } catch (error: any) {
      throw new WorkspaceError(`Failed to get staged files: ${error.message}`);
    }
  }

  /** 
   * Get list of untracked files 
   * @returns Array of untracked file paths
   */
  async getUntrackedFiles(): Promise<string[]> {
    try {
      const status = await this.git.status();
      return status.not_added;
    } catch (error: any) {
      throw new WorkspaceError(`Failed to get untracked files: ${error.message}`);
    }
  }
}
