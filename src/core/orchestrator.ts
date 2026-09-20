import type { PlannerAgent, ExecutorAgent, ReviewerAgent } from '../agents/interfaces.js';
import type { AgentTask } from '../agents/types.js';
import { PlanManager } from '../plans/manager.js';
import { PlanStatus } from '../plans/types.js';
import type { Plan } from '../plans/types.js';
import { ContextEngine } from '../context/engine.js';
import { WorkspaceManager } from '../workspace/manager.js';
import { SnapshotManager } from '../state/snapshot.js';
import { ExecutionTracer } from '../state/tracer.js';
import type { ExecutionTrace, ExecutionReport, ValidationResult } from '../state/types.js';
import { SecureCommandExecutor } from '../security/executor.js';
import type { DevAIConfig } from '../config/types.js';
import type { ProgressCallback, PlanOptions, ExecuteOptions, RunOptions } from './types.js';
import { ExecutionError, PlanningError } from '../errors/index.js';

/**
 * Central orchestration engine.
 * Coordinates the plan → execute → validate → review lifecycle.
 */
export class Orchestrator {
  private planManager: PlanManager;
  private contextEngine: ContextEngine;
  private snapshotManager: SnapshotManager;
  private tracer: ExecutionTracer;
  private commandExecutor: SecureCommandExecutor;

  constructor(
    private workspace: WorkspaceManager,
    private planner: PlannerAgent,
    private executor: ExecutorAgent,
    private reviewer: ReviewerAgent,
    private config: DevAIConfig,
    private onProgress?: ProgressCallback,
  ) {
    const root = workspace.getRoot();
    this.planManager = new PlanManager(root);
    this.contextEngine = new ContextEngine(config.limits.maxContextFiles);
    this.snapshotManager = new SnapshotManager();
    this.tracer = new ExecutionTracer(root);
    this.commandExecutor = new SecureCommandExecutor(config.security.commandPolicies);
  }

  /**
   * Create an implementation plan from a natural language request.
   */
  async plan(options: PlanOptions): Promise<Plan> {
    const { request, includeFiles } = options;

    this.emit({ stage: 'understanding', message: `"${request}"` });

    // Analyze workspace
    this.emit({ stage: 'analyzing', message: 'Inspecting workspace...' });
    const workspaceInfo = await this.workspace.inspect();

    // Build context
    this.emit({ stage: 'building_context', message: 'Selecting relevant files...' });
    const context = await this.contextEngine.buildContext(
      request,
      this.workspace,
      this.planManager,
      { includeFiles },
    );
    this.emit({
      stage: 'building_context',
      message: `${context.relevantFiles.length} files selected, ${context.skills.length} skills matched`,
      fileCount: context.relevantFiles.length,
    });

    // Generate plan
    this.emit({ stage: 'planning', message: 'Generating implementation plan...' });
    let plan = await this.planner.createPlan(request, context);

    // Assign proper ID and metadata
    const nextId = await this.planManager.getNextId();
    plan = {
      ...plan,
      id: nextId,
      status: PlanStatus.AwaitingApproval,
      branch: context.gitState.branch,
      planner: this.planner.name,
      created: new Date().toISOString().split('T')[0],
      updated: new Date().toISOString().split('T')[0],
    };

    // Save plan
    await this.planManager.createPlan(plan);
    this.emit({ stage: 'plan_generated', plan });

    return plan;
  }

  /**
   * Execute an approved plan.
   */
  async execute(options: ExecuteOptions): Promise<ExecutionReport> {
    const { planId } = options;

    // Load plan
    const plan = await this.planManager.loadPlan(planId);

    if (plan.status !== PlanStatus.Approved) {
      throw new PlanningError(
        `Plan ${planId} is not approved. Current status: ${plan.status}`,
        { planId, status: plan.status },
      );
    }

    // Transition to executing
    await this.planManager.transitionStatus(planId, PlanStatus.Executing);
    this.emit({ stage: 'executing', message: `Executing plan ${planId}...` });

    // Snapshot before
    const snapshotBefore = await this.snapshotManager.capture(this.workspace);

    // Build context
    const context = await this.contextEngine.buildContext(
      plan.objective,
      this.workspace,
      this.planManager,
    );

    const startTime = Date.now();
    let iteration = 0;
    let lastResult = '';
    let validationResult: ValidationResult | null = null;
    let reviewResult: import('../agents/types.js').ReviewResult | null = null;

    // Execution loop
    while (iteration < this.config.limits.maxIterations) {
      iteration++;
      this.emit({ stage: 'executing', message: `Iteration ${iteration}...`, iteration });

      // Build agent task
      const task: AgentTask = {
        plan,
        context,
        instructions: this.buildInstructions(plan, lastResult),
        constraints: plan.constraints,
        acceptanceCriteria: plan.acceptanceCriteria,
      };

      // Execute
      const agentResult = await this.executor.execute(task);

      if (agentResult.status === 'blocked') {
        await this.planManager.transitionStatus(planId, PlanStatus.Failed);
        throw new ExecutionError(
          `Executor blocked: ${agentResult.blockReason}`,
          { planId, blockReason: agentResult.blockReason },
        );
      }

      // Validate
      if (this.config.validation.commands.length > 0) {
        this.emit({ stage: 'validating', message: 'Running validation...' });
        await this.planManager.transitionStatus(planId, PlanStatus.Validating);
        validationResult = await this.runValidation();

        if (!validationResult.allPassed) {
          const failures = validationResult.results
            .filter((r) => !r.passed)
            .map((r) => `${r.command}: ${r.output.substring(0, 500)}`)
            .join('\n');

          lastResult = `Validation failed:\n${failures}`;

          if (iteration >= this.config.limits.maxIterations) {
            await this.planManager.transitionStatus(planId, PlanStatus.Failed);
            break;
          }

          await this.planManager.transitionStatus(planId, PlanStatus.Executing);
          this.emit({ stage: 'fixing', message: 'Fixing validation errors...', iteration });
          continue;
        }
      }

      // Review
      this.emit({ stage: 'reviewing', message: 'Reviewing implementation...' });
      await this.planManager.transitionStatus(planId, PlanStatus.Reviewing);

      const diff = await this.workspace.getDiff();
      const testOutput = validationResult
        ? validationResult.results.map((r) => `${r.command}: ${r.passed ? 'PASS' : 'FAIL'}`).join('\n')
        : 'No validation configured';

      reviewResult = await this.reviewer.review(plan, diff, testOutput, context);

      if (reviewResult.status === 'approved') {
        await this.planManager.transitionStatus(planId, PlanStatus.Completed);
        break;
      }

      // Changes requested
      const findings = reviewResult.findings
        .map((f) => `[${f.severity}] ${f.file ? `${f.file}:` : ''}${f.description} → ${f.recommendation}`)
        .join('\n');

      lastResult = `Review requested changes:\n${findings}`;

      if (iteration >= this.config.limits.maxIterations) {
        await this.planManager.transitionStatus(planId, PlanStatus.Failed);
        break;
      }

      await this.planManager.transitionStatus(planId, PlanStatus.Executing);
      this.emit({ stage: 'fixing', message: 'Addressing review findings...', iteration });
    }

    // Snapshot after
    const snapshotAfter = await this.snapshotManager.capture(this.workspace);
    const diffStats = await this.workspace.getDiffStats();
    const durationMs = Date.now() - startTime;

    // Build execution report
    const report: ExecutionReport = {
      planId,
      planTitle: plan.title,
      status: reviewResult?.status === 'approved' ? 'completed' : 'failed',
      iterations: iteration,
      filesModified: snapshotAfter.modifiedFiles.filter(
        (f) => !snapshotBefore.modifiedFiles.includes(f),
      ),
      filesCreated: [],
      filesDeleted: [],
      linesAdded: diffStats.insertions,
      linesRemoved: diffStats.deletions,
      validationResults: validationResult,
      reviewResult,
      durationMs,
    };

    // Save trace
    const traceId = await this.tracer.getNextId();
    const trace: ExecutionTrace = {
      id: traceId,
      planId,
      request: plan.objective,
      models: {
        planner: plan.planner,
        executor: this.executor.name,
        reviewer: this.reviewer.name,
      },
      contextFiles: [],
      iterations: iteration,
      commands: [],
      filesModified: report.filesModified,
      filesCreated: report.filesCreated,
      filesDeleted: report.filesDeleted,
      validationResults: validationResult,
      reviewResult,
      usage: {},
      durationMs,
      snapshotBefore,
      snapshotAfter,
      status: report.status,
      startedAt: new Date(startTime).toISOString(),
      finishedAt: new Date().toISOString(),
    };
    await this.tracer.save(trace);

    this.emit({ stage: 'completed', report });
    return report;
  }

  /**
   * Run the full workflow: plan → approve → execute → review.
   */
  async run(options: RunOptions): Promise<ExecutionReport> {
    const plan = await this.plan({
      request: options.request,
      includeFiles: options.includeFiles,
    });

    if (!options.skipApproval) {
      this.emit({ stage: 'awaiting_approval', plan });
      // In the CLI, the approval flow is handled by the command layer.
      // Here, we just transition to approved.
    }

    await this.planManager.transitionStatus(plan.id, PlanStatus.Approved);
    return this.execute({ planId: plan.id });
  }

  /** Get the plan manager instance */
  getPlanManager(): PlanManager {
    return this.planManager;
  }

  /** Get the context engine instance */
  getContextEngine(): ContextEngine {
    return this.contextEngine;
  }

  /**
   * Run configured validation commands.
   */
  private async runValidation(): Promise<ValidationResult> {
    const results = [];
    for (const cmd of this.config.validation.commands) {
      const start = Date.now();
      try {
        const result = await this.commandExecutor.execute({
          command: cmd,
          cwd: this.workspace.getRoot(),
          timeoutMs: 120_000,
        });
        results.push({
          command: cmd,
          passed: result.exitCode === 0,
          output: result.stdout + result.stderr,
          durationMs: result.durationMs,
        });
      } catch (error) {
        results.push({
          command: cmd,
          passed: false,
          output: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - start,
        });
      }
    }

    return {
      allPassed: results.every((r) => r.passed),
      results,
    };
  }

  /**
   * Build instruction string for the executor.
   */
  private buildInstructions(plan: Plan, previousFeedback: string): string {
    let instructions = `Execute the following implementation plan:\n\n`;
    instructions += `# ${plan.title}\n\n`;
    instructions += `## Objective\n${plan.objective}\n\n`;

    if (plan.implementationSteps.length > 0) {
      instructions += `## Steps\n`;
      for (const step of plan.implementationSteps) {
        instructions += `\n### Step ${step.number}: ${step.title}\n${step.description}\n`;
      }
    }

    if (plan.filesToModify.length > 0) {
      instructions += `\n## Files To Modify\n${plan.filesToModify.map((f) => `- ${f}`).join('\n')}\n`;
    }
    if (plan.filesToCreate.length > 0) {
      instructions += `\n## Files To Create\n${plan.filesToCreate.map((f) => `- ${f}`).join('\n')}\n`;
    }

    if (plan.constraints.length > 0) {
      instructions += `\n## Constraints\n${plan.constraints.map((c) => `- ${c}`).join('\n')}\n`;
    }

    if (previousFeedback) {
      instructions += `\n## Previous Feedback (must address)\n${previousFeedback}\n`;
    }

    instructions += `\n## IMPORTANT\n`;
    instructions += `- Follow the plan steps precisely\n`;
    instructions += `- Do not redefine the objective\n`;
    instructions += `- If you cannot complete a step, report it instead of silently changing the goal\n`;
    instructions += `- Ensure all acceptance criteria are met\n`;

    return instructions;
  }

  /**
   * Emit a progress event.
   */
  private emit(event: import('./types.js').ProgressEvent): void {
    this.onProgress?.(event);
  }
}
