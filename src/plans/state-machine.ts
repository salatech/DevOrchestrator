import { PlanStatus } from './types.js';
import { PlanningError } from '../errors/index.js';

const transitions = new Map<PlanStatus, PlanStatus[]>([
  [PlanStatus.Draft, [PlanStatus.AwaitingApproval]],
  [PlanStatus.AwaitingApproval, [PlanStatus.Approved, PlanStatus.Cancelled]],
  [PlanStatus.Approved, [PlanStatus.Executing, PlanStatus.Cancelled]],
  [PlanStatus.Executing, [PlanStatus.Validating, PlanStatus.Failed, PlanStatus.Cancelled]],
  [PlanStatus.Validating, [PlanStatus.Reviewing, PlanStatus.Executing, PlanStatus.Failed, PlanStatus.Cancelled]],
  [PlanStatus.Reviewing, [PlanStatus.Completed, PlanStatus.Executing, PlanStatus.Failed, PlanStatus.Cancelled]],
  [PlanStatus.Completed, []],
  [PlanStatus.Failed, [PlanStatus.Draft]],
  [PlanStatus.Cancelled, []]
]);

/** Check if a status transition is valid */
export function isValidTransition(from: PlanStatus, to: PlanStatus): boolean {
  const validTargets = transitions.get(from) || [];
  return validTargets.includes(to);
}

/** Validate a transition, throwing if invalid */
export function validateTransition(from: PlanStatus, to: PlanStatus): void {
  if (!isValidTransition(from, to)) {
    throw new PlanningError(`Invalid transition from ${from} to ${to}`);
  }
}

/** Check if a status is terminal */
export function isTerminalStatus(status: PlanStatus): boolean {
  return status === PlanStatus.Completed || status === PlanStatus.Cancelled;
}

/** Get valid next statuses for a given status */
export function getValidNextStatuses(from: PlanStatus): PlanStatus[] {
  return transitions.get(from) || [];
}
