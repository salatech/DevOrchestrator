import type { Plan } from './types.js';
import { PlanningError } from '../errors/index.js';

/** Check if id matches PLAN-NNN pattern */
export function validatePlanId(id: string): boolean {
  return /^PLAN-\d{3}$/.test(id);
}

/** Validate a plan object */
export function validatePlan(plan: Plan): void {
  if (!plan.id || !validatePlanId(plan.id)) {
    throw new PlanningError(`Invalid or missing plan id: ${plan.id}`);
  }
  if (!plan.title || plan.title.trim() === '') {
    throw new PlanningError('Plan title is missing or empty');
  }
  const validStatuses = ['draft', 'awaiting_approval', 'approved', 'executing', 'validating', 'reviewing', 'completed', 'failed', 'cancelled'];
  if (!plan.status || !validStatuses.includes(plan.status)) {
    throw new PlanningError(`Invalid plan status: ${plan.status}`);
  }
  if (!plan.objective || plan.objective.trim() === '') {
    throw new PlanningError('Plan objective is missing or empty');
  }
  if (!plan.created || isNaN(Date.parse(plan.created))) {
    throw new PlanningError('Plan created date is missing or invalid');
  }
  if (!plan.implementationSteps || plan.implementationSteps.length === 0) {
    throw new PlanningError('Plan implementationSteps is empty');
  }
  if (!plan.acceptanceCriteria || plan.acceptanceCriteria.length === 0) {
    throw new PlanningError('Plan acceptanceCriteria is empty');
  }
}
