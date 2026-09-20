import type { AgentCapabilities, AgentTask, AgentResult, ReviewResult } from './types.js';
import type { TaskContext } from '../context/types.js';
import type { Plan } from '../plans/types.js';

/** Base agent interface */
export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly capabilities: AgentCapabilities;
}

/** Agent that can create implementation plans */
export interface PlannerAgent extends Agent {
  createPlan(request: string, context: TaskContext): Promise<Plan>;
}

/** Agent that can execute implementation plans */
export interface ExecutorAgent extends Agent {
  execute(task: AgentTask): Promise<AgentResult>;
}

/** Agent that can review implementations */
export interface ReviewerAgent extends Agent {
  review(
    plan: Plan,
    diff: string,
    testResults: string,
    context: TaskContext,
  ): Promise<ReviewResult>;
}
