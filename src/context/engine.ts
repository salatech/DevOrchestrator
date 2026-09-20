import type { TaskContext, ContextOptions, ContextInspection, ExcludedFile } from './types.js';
import { ContextCollector } from './collector.js';
import { ContextSelector } from './selector.js';
import type { WorkspaceManager } from '../workspace/manager.js';
import type { PlanManager } from '../plans/manager.js';
import { discoverSkills } from '../skills/discovery.js';
import { loadSkills } from '../skills/loader.js';
import { isSecretPath, getContextExclusionReason } from '../workspace/filesystem.js';

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

  async buildContext(
    request: string,
    workspace: WorkspaceManager,
    planManager: PlanManager,
    options?: ContextOptions,
  ): Promise<TaskContext> {
    const collected = await this.collector.gather(workspace, planManager);

    const relevantFiles = await this.selector.select(
      request,
      collected.allFiles,
      workspace,
      collected.gitState.modifiedFiles,
    );

    if (options?.includeFiles) {
      for (const filePath of options.includeFiles) {
        if (isSecretPath(filePath)) continue;
        if (!relevantFiles.some((f) => f.path === filePath)) {
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

    const allSkills = await loadSkills(workspace.getRoot());
    const matchedSkills = discoverSkills(request, allSkills);

    return {
      project: collected.project,
      architecture: collected.architecture,
      conventions: collected.conventions,
      skills: matchedSkills,
      relevantFiles,
      gitState: collected.gitState,
      existingPlans: collected.existingPlans,
      packageInfo: collected.packageInfo,
    };
  }

  /**
   * Explain which files would be sent to the model and which would not.
   */
  async inspectContext(
    request: string,
    workspace: WorkspaceManager,
    planManager: PlanManager,
    options?: ContextOptions,
  ): Promise<ContextInspection> {
    const context = await this.buildContext(request, workspace, planManager, options);
    const collected = await this.collector.gather(workspace, planManager);
    const includedPaths = new Set(context.relevantFiles.map((file) => file.path));
    const excluded: ExcludedFile[] = [];

    for (const filePath of collected.allFiles) {
      if (includedPaths.has(filePath)) continue;
      excluded.push({
        path: filePath,
        reason: getContextExclusionReason(filePath) ?? 'below relevance cutoff',
      });
    }

    for (const secretCandidate of ['.env', '.env.local', 'credentials.json', 'id_rsa']) {
      if (includedPaths.has(secretCandidate)) continue;
      if (await workspace.fileExists(secretCandidate)) {
        excluded.unshift({
          path: secretCandidate,
          reason: getContextExclusionReason(secretCandidate) ?? 'secret or credential file',
        });
      }
    }

    return {
      included: context.relevantFiles,
      excluded,
      skills: context.skills,
      docs: [
        { path: '.ai/PROJECT.md', loaded: Boolean(context.project) },
        { path: '.ai/ARCHITECTURE.md', loaded: Boolean(context.architecture) },
        { path: '.ai/CONVENTIONS.md', loaded: Boolean(context.conventions) },
      ],
    };
  }
}
