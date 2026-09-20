import pc from 'picocolors';
import type { Plan } from '../plans/types.js';
import { PlanStatus } from '../plans/types.js';
import type { ExecutionReport } from '../state/types.js';
import type { ReviewResult, Finding } from '../agents/types.js';

/**
 * Format a plan status with color coding.
 */
export function formatStatus(status: PlanStatus): string {
  switch (status) {
    case PlanStatus.Draft:
      return pc.gray('draft');
    case PlanStatus.AwaitingApproval:
      return pc.yellow('awaiting approval');
    case PlanStatus.Approved:
      return pc.green('approved');
    case PlanStatus.Executing:
      return pc.blue('executing');
    case PlanStatus.Validating:
      return pc.blue('validating');
    case PlanStatus.Reviewing:
      return pc.blue('reviewing');
    case PlanStatus.Completed:
      return pc.green('✓ completed');
    case PlanStatus.Failed:
      return pc.red('✗ failed');
    case PlanStatus.Cancelled:
      return pc.gray('cancelled');
    default:
      return pc.gray(status);
  }
}

/**
 * Format a plan for terminal display.
 */
export function formatPlan(plan: Plan): string {
  const lines: string[] = [];

  lines.push(pc.bold(`${plan.id}: ${plan.title}`));
  lines.push(`Status: ${formatStatus(plan.status)}`);
  lines.push(`Created: ${plan.created} | Planner: ${plan.planner} | Branch: ${plan.branch}`);
  lines.push('');

  if (plan.objective) {
    lines.push(pc.bold('Objective'));
    lines.push(plan.objective);
    lines.push('');
  }

  if (plan.currentState) {
    lines.push(pc.bold('Current State'));
    lines.push(plan.currentState);
    lines.push('');
  }

  if (plan.relevantFiles.length > 0) {
    lines.push(pc.bold('Relevant Files'));
    for (const f of plan.relevantFiles) {
      lines.push(`  ${pc.dim('•')} ${f}`);
    }
    lines.push('');
  }

  if (plan.filesToModify.length > 0) {
    lines.push(pc.bold('Files To Modify'));
    for (const f of plan.filesToModify) {
      lines.push(`  ${pc.yellow('~')} ${f}`);
    }
    lines.push('');
  }

  if (plan.filesToCreate.length > 0) {
    lines.push(pc.bold('Files To Create'));
    for (const f of plan.filesToCreate) {
      lines.push(`  ${pc.green('+')} ${f}`);
    }
    lines.push('');
  }

  if (plan.implementationSteps.length > 0) {
    lines.push(pc.bold('Implementation Steps'));
    for (const step of plan.implementationSteps) {
      lines.push(`  ${pc.cyan(`${step.number}.`)} ${pc.bold(step.title)}`);
      if (step.description) {
        const descLines = step.description.split('\n').map((l) => `     ${l}`);
        lines.push(...descLines);
      }
    }
    lines.push('');
  }

  if (plan.constraints.length > 0) {
    lines.push(pc.bold('Constraints'));
    for (const c of plan.constraints) {
      lines.push(`  ${pc.dim('•')} ${c}`);
    }
    lines.push('');
  }

  if (plan.testingStrategy) {
    lines.push(pc.bold('Testing Strategy'));
    lines.push(plan.testingStrategy);
    lines.push('');
  }

  if (plan.acceptanceCriteria.length > 0) {
    lines.push(pc.bold('Acceptance Criteria'));
    for (const c of plan.acceptanceCriteria) {
      lines.push(`  ${pc.dim('☐')} ${c}`);
    }
    lines.push('');
  }

  if (plan.risks.length > 0) {
    lines.push(pc.bold('Risks'));
    for (const r of plan.risks) {
      lines.push(`  ${pc.yellow('⚠')} ${r}`);
    }
    lines.push('');
  }

  if (plan.outOfScope.length > 0) {
    lines.push(pc.bold('Out Of Scope'));
    for (const item of plan.outOfScope) {
      lines.push(`  ${pc.dim('•')} ${item}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format an execution report for terminal display.
 */
export function formatReport(report: ExecutionReport): string {
  const lines: string[] = [];

  const statusIcon = report.status === 'completed' ? pc.green('✓') : pc.red('✗');
  lines.push(`${statusIcon} ${pc.bold(`Execution Report: ${report.planTitle}`)}`);
  lines.push('');

  lines.push(`Plan:       ${report.planId}`);
  lines.push(`Status:     ${report.status === 'completed' ? pc.green('completed') : pc.red(report.status)}`);
  lines.push(`Iterations: ${report.iterations}`);
  lines.push(`Duration:   ${formatDuration(report.durationMs)}`);
  lines.push('');

  // File changes
  const totalChanges = report.filesModified.length + report.filesCreated.length + report.filesDeleted.length;
  if (totalChanges > 0) {
    lines.push(pc.bold('Changes'));
    for (const f of report.filesModified) {
      lines.push(`  ${pc.yellow('~')} ${f}`);
    }
    for (const f of report.filesCreated) {
      lines.push(`  ${pc.green('+')} ${f}`);
    }
    for (const f of report.filesDeleted) {
      lines.push(`  ${pc.red('-')} ${f}`);
    }
    lines.push(`  ${pc.green(`+${report.linesAdded}`)} ${pc.red(`-${report.linesRemoved}`)} lines`);
    lines.push('');
  }

  // Validation
  if (report.validationResults) {
    lines.push(pc.bold('Validation'));
    for (const r of report.validationResults.results) {
      const icon = r.passed ? pc.green('✓') : pc.red('✗');
      lines.push(`  ${icon} ${r.command}`);
    }
    lines.push('');
  }

  // Review
  if (report.reviewResult) {
    lines.push(pc.bold('Review'));
    lines.push(`  Status: ${report.reviewResult.status === 'approved' ? pc.green('approved') : pc.yellow('changes requested')}`);
    if (report.reviewResult.findings.length > 0) {
      for (const f of report.reviewResult.findings) {
        lines.push(`  ${formatFindingSeverity(f.severity)} ${f.description}`);
      }
    }
    lines.push('');
  }

  if (report.error) {
    lines.push(pc.red(`Error: ${report.error}`));
  }

  return lines.join('\n');
}

/**
 * Format a review result for terminal display.
 */
export function formatReview(review: ReviewResult): string {
  const lines: string[] = [];

  const icon = review.status === 'approved' ? pc.green('✓') : pc.yellow('⚠');
  lines.push(`${icon} ${pc.bold('Code Review')}: ${review.status === 'approved' ? pc.green('Approved') : pc.yellow('Changes Requested')}`);
  lines.push('');
  lines.push(review.summary);
  lines.push('');

  if (review.findings.length > 0) {
    lines.push(pc.bold('Findings'));
    for (const finding of review.findings) {
      const severity = formatFindingSeverity(finding.severity);
      const location = finding.file ? `${finding.file}${finding.line ? `:${finding.line}` : ''}` : '';
      lines.push(`  ${severity} ${finding.description}`);
      if (location) {
        lines.push(`    ${pc.dim(`at ${location}`)}`);
      }
      lines.push(`    ${pc.dim(`→ ${finding.recommendation}`)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format finding severity with color.
 */
function formatFindingSeverity(severity: Finding['severity']): string {
  switch (severity) {
    case 'critical':
      return pc.bgRed(pc.white(' CRITICAL '));
    case 'high':
      return pc.red('[HIGH]');
    case 'medium':
      return pc.yellow('[MEDIUM]');
    case 'low':
      return pc.dim('[LOW]');
  }
}

/**
 * Format duration in human-readable form.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = ((ms % 60_000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}
