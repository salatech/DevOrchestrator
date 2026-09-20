import * as path from 'node:path';
import type { CollectedContext, SkillContext } from './types.js';
import type { WorkspaceManager } from '../workspace/manager.js';
import type { PlanManager } from '../plans/manager.js';
import { loadSkills } from '../skills/loader.js';

/**
 * Gathers raw context from all sources.
 */
export class ContextCollector {
  /**
   * Gather all raw context from the workspace.
   * Reads .ai/ docs, skills, file list, git state, package info, and existing plans.
   */
  async gather(
    workspace: WorkspaceManager,
    planManager: PlanManager,
  ): Promise<CollectedContext> {
    const root = workspace.getRoot();
    
    // Read .ai/ context files (return empty string if not found)
    const project = await this.readOptionalFile(workspace, '.ai/PROJECT.md');
    const architecture = await this.readOptionalFile(workspace, '.ai/ARCHITECTURE.md');
    const conventions = await this.readOptionalFile(workspace, '.ai/CONVENTIONS.md');
    
    // Load skills
    const skills = await this.loadSkillContexts(root);
    
    // List all source files
    const allFiles = await workspace.listSourceFiles();
    
    // Get git state
    const gitState = await workspace.getGitState();
    
    // Get existing plans
    const existingPlans = await planManager.listPlans();
    
    // Get package info
    const packageInfo = await workspace.getPackageInfo();
    
    return { project, architecture, conventions, skills, allFiles, gitState, existingPlans, packageInfo };
  }

  private async readOptionalFile(workspace: WorkspaceManager, relativePath: string): Promise<string> {
    try {
      return await workspace.readFile(relativePath);
    } catch {
      return '';
    }
  }

  private async loadSkillContexts(root: string): Promise<SkillContext[]> {
    const skills = await loadSkills(root);
    return skills.map(s => ({
      name: s.name,
      content: s.content,
      relevanceScore: 0, // scored later by selector
    }));
  }
}
