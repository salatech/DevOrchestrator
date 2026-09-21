import type { PlannerAgent, ExecutorAgent, ReviewerAgent } from '../agents/interfaces.js';
import type { AgentTask, ReviewResult } from '../agents/types.js';
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
import { redactSecrets } from '../logging/redact.js';

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
    approvalHandler?: (command: string, reason: string) => Promise<boolean>,
  ) {
    const root = workspace.getRoot();
    this.planManager = new PlanManager(root);
    this.contextEngine = new ContextEngine(config.limits.maxContextFiles);
    this.snapshotManager = new SnapshotManager();
    this.tracer = new ExecutionTracer(root);
    this.commandExecutor = new SecureCommandExecutor(
      config.security.commandPolicies,
      approvalHandler,
    );
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
      branch: context.gitState.branch || plan.branch,
      planner: this.planner.name,
      created: new Date().toISOString().split('T')[0],
      updated: new Date().toISOString().split('T')[0],
      objective: plan.objective?.trim() ? plan.objective : request,
      implementationSteps:
        plan.implementationSteps.length > 0
          ? plan.implementationSteps
          : [{ number: 1, title: 'Implement request', description: request }],
      acceptanceCriteria:
        plan.acceptanceCriteria.length > 0
          ? plan.acceptanceCriteria
          : ['The request is implemented', 'Existing tests still pass'],
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

    if (plan.status !== PlanStatus.Approved && plan.status !== PlanStatus.Reviewing) {
      throw new PlanningError(
        `Plan ${planId} cannot be executed from status: ${plan.status}. Approve it first (or retry from reviewing).`,
        {
          planId,
          status: plan.status,
        },
      );
    }

    // Transition to executing (from approved or reviewing retry)
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
    let reviewResult: ReviewResult | null = null;
    const abort = { interrupted: false };
    const onSignal = () => {
      abort.interrupted = true;
    };
    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);

    // Execution loop
    try {
      while (iteration < this.config.limits.maxIterations) {
        if (abort.interrupted) {
          break;
        }
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
          throw new ExecutionError(`Executor blocked: ${agentResult.blockReason}`, {
            planId,
            blockReason: agentResult.blockReason,
          });
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

        const changeView = await this.workspace.buildChangeMaterial({
          preferredPaths: [...plan.filesToCreate, ...plan.filesToModify],
          before: snapshotBefore,
        });
        const diff = changeView.material;
        const testOutput = validationResult
          ? validationResult.results
              .map((r) => `${r.command}: ${r.passed ? 'PASS' : 'FAIL'}`)
              .join('\n')
          : 'No validation configured';

        reviewResult = await this.reviewer.review(plan, diff, testOutput, context);

        const midSnapshot = await this.snapshotManager.capture(this.workspace);
        const midDiff = this.snapshotManager.compare(snapshotBefore, midSnapshot);
        const projectChanges = [...midDiff.filesAdded, ...midDiff.filesModified, ...midDiff.filesRemoved].filter(
          (file) => !file.startsWith('.ai/'),
        );

        if (reviewResult.status === 'approved' && projectChanges.length === 0) {
          lastResult =
            'No project files were created or modified. Implement the plan in the app files (HTML/CSS/JS, etc.), not only under .ai/.';
          if (iteration >= this.config.limits.maxIterations) {
            await this.planManager.transitionStatus(planId, PlanStatus.Failed);
            break;
          }
          await this.planManager.transitionStatus(planId, PlanStatus.Executing);
          this.emit({
            stage: 'fixing',
            message: 'Implementation missing — continuing execution...',
            iteration,
          });
          continue;
        }

        if (reviewResult.status === 'approved') {
          await this.planManager.transitionStatus(planId, PlanStatus.Completed);
          break;
        }

        // Changes requested
        const findings = reviewResult.findings
          .map(
            (f) =>
              `[${f.severity}] ${f.file ? `${f.file}:` : ''}${f.description} → ${f.recommendation}`,
          )
          .join('\n');

        lastResult = `Review requested changes:\n${findings}`;

        if (iteration >= this.config.limits.maxIterations) {
          await this.planManager.transitionStatus(planId, PlanStatus.Failed);
          break;
        }

        await this.planManager.transitionStatus(planId, PlanStatus.Executing);
        this.emit({ stage: 'fixing', message: 'Addressing review findings...', iteration });
      }
    } finally {
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
    }

    if (abort.interrupted) {
      const current = await this.planManager.loadPlan(planId);
      if (current.status !== PlanStatus.Completed && current.status !== PlanStatus.Cancelled) {
        try {
          await this.planManager.transitionStatus(planId, PlanStatus.Cancelled);
        } catch {
          await this.planManager.transitionStatus(planId, PlanStatus.Failed).catch(() => current);
        }
      }
    }

    // Snapshot after
    const snapshotAfter = await this.snapshotManager.capture(this.workspace);
    const snapshotDiff = this.snapshotManager.compare(snapshotBefore, snapshotAfter);
    const diffStats = await this.workspace.getDiffStats();
    const durationMs = Date.now() - startTime;
    const currentPlan = await this.planManager.loadPlan(planId);
    const finalStatus = abort.interrupted
      ? 'cancelled'
      : currentPlan.status === PlanStatus.Completed
        ? 'completed'
        : currentPlan.status === PlanStatus.Cancelled
          ? 'cancelled'
          : 'failed';

    const report: ExecutionReport = {
      planId,
      planTitle: plan.title,
      status: finalStatus,
      iterations: iteration,
      filesModified: snapshotDiff.filesModified,
      filesCreated: snapshotDiff.filesAdded,
      filesDeleted: snapshotDiff.filesRemoved,
      linesAdded: diffStats.insertions,
      linesRemoved: diffStats.deletions,
      validationResults: validationResult,
      reviewResult,
      durationMs,
      error: abort.interrupted
        ? 'Execution interrupted'
        : finalStatus === 'failed'
          ? lastResult || 'Execution finished without review approval'
          : undefined,
    };

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
      contextFiles: context.relevantFiles.map((file) => file.path),
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
      error: report.error,
      startedAt: new Date(startTime).toISOString(),
      finishedAt: new Date().toISOString(),
    };
    await this.tracer.save(trace);

    if (finalStatus === 'failed' || finalStatus === 'cancelled') {
      this.emit({
        stage: 'failed',
        error: report.error ?? 'Execution finished without review approval',
      });
    } else {
      this.emit({ stage: 'completed', report });
    }
    return report;
  }

  /**
   * Review the current workspace diff against a plan.
   */
  async review(planId: string): Promise<ReviewResult> {
    const plan = await this.planManager.loadPlan(planId);
    this.emit({ stage: 'reviewing', message: `Reviewing plan ${planId}...` });

    const context = await this.contextEngine.buildContext(
      plan.objective,
      this.workspace,
      this.planManager,
    );
    const changeView = await this.workspace.buildChangeMaterial({
      preferredPaths: [...plan.filesToCreate, ...plan.filesToModify],
    });
    const reviewResult = await this.reviewer.review(
      plan,
      changeView.material,
      'Manual review',
      context,
    );

    let status = plan.status;
    if (status === PlanStatus.Executing || status === PlanStatus.Validating) {
      await this.planManager.transitionStatus(planId, PlanStatus.Reviewing);
      status = PlanStatus.Reviewing;
    }

    if (status === PlanStatus.Reviewing && reviewResult.status === 'approved') {
      await this.planManager.transitionStatus(planId, PlanStatus.Completed);
    }

    return reviewResult;
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
      throw new PlanningError(
        `Plan ${plan.id} is awaiting approval. Run \`devorch approve ${plan.id}\` then \`devorch execute ${plan.id}\`, or pass --yes.`,
        { planId: plan.id },
      );
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
          allowedRoot: this.workspace.getRoot(),
          timeoutMs: 120_000,
        });
        results.push({
          command: cmd,
          passed: result.exitCode === 0,
          output: redactSecrets(result.stdout + result.stderr),
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
