import type { TaskContext, ContextOptions } from './types.js';
import { ContextCollector } from './collector.js';
import { ContextSelector } from './selector.js';
import type { WorkspaceManager } from '../workspace/manager.js';
import type { PlanManager } from '../plans/manager.js';
import { discoverSkills } from '../skills/discovery.js';
import { loadSkills } from '../skills/loader.js';

/**
 * Context engine facade.
 */
export class ContextEngine {
  private collector: ContextCollector;
  private selector: ContextSelector;

  constructor(maxFiles: number = 30) {
    this.collector = new ContextCollector();
    this.selector = new ContextSelector(maxFiles);
  }

  /**
   * Build complete task context for the LLM.
   * 1. Gather all raw context
   * 2. Select relevant files
   * 3. Discover applicable skills
   * 4. Assemble final TaskContext
   */
  async buildContext(
    request: string,
    workspace: WorkspaceManager,
    planManager: PlanManager,
    options?: ContextOptions,
  ): Promise<TaskContext> {
    // Gather raw context
    const collected = await this.collector.gather(workspace, planManager);
    
    // Select relevant source files
    const relevantFiles = await this.selector.select(
      request,
      collected.allFiles,
      workspace,
      collected.gitState.modifiedFiles,
    );
    
    // Add any explicitly requested files
    if (options?.includeFiles) {
      for (const filePath of options.includeFiles) {
        if (!relevantFiles.some(f => f.path === filePath)) {
          try {
            const content = await workspace.readFile(filePath);
            relevantFiles.push({
              path: filePath,
              content,
              relevanceScore: 1,
              reason: 'explicitly included',
            });
          } catch {
            // Skip if file doesn't exist
          }
        }
      }
    }
    
    // Discover applicable skills
    const allSkills = await loadSkills(workspace.getRoot());
    const matchedSkills = discoverSkills(request, allSkills);
    
    return {
      project: collected.project,
      architecture: collected.architecture,
      conventions: collected.conventions,
      skills: matchedSkills,
      relevantFiles,
      gitState: options?.includeGitState !== false ? collected.gitState : collected.gitState,
      existingPlans: collected.existingPlans,
      packageInfo: collected.packageInfo,
    };
  }
}
