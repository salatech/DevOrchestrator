/** Possible plan statuses */
export enum PlanStatus {
  Draft = 'draft',
  AwaitingApproval = 'awaiting_approval',
  Approved = 'approved',
  Executing = 'executing',
  Validating = 'validating',
  Reviewing = 'reviewing',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

/** An implementation step within a plan */
export interface ImplementationStep {
  /** Step number */
  number: number;
  /** Step title */
  title: string;
  /** Detailed description */
  description: string;
  /** Files affected by this step */
  files?: string[];
}

/** YAML frontmatter metadata for a plan */
export interface PlanFrontmatter {
  id: string;
  title: string;
  status: PlanStatus;
  created: string;
  updated?: string;
  planner: string;
  branch: string;
}

/** Complete plan structure */
export interface Plan {
  /** Unique plan identifier (e.g., "PLAN-001") */
  id: string;
  /** Human-readable title */
  title: string;
  /** Current status */
  status: PlanStatus;
  /** ISO date when plan was created */
  created: string;
  /** ISO date when plan was last updated */
  updated: string;
  /** Model/agent that created the plan */
  planner: string;
  /** Git branch at time of creation */
  branch: string;
  /** What the plan aims to achieve */
  objective: string;
  /** Description of current project state relevant to plan */
  currentState: string;
  /** Files relevant to the plan */
  relevantFiles: string[];
  /** Files to be modified */
  filesToModify: string[];
  /** Files to be created */
  filesToCreate: string[];
  /** Ordered implementation steps */
  implementationSteps: ImplementationStep[];
  /** Constraints and limitations */
  constraints: string[];
  /** How to test the implementation */
  testingStrategy: string;
  /** What must be true for the plan to be considered complete */
  acceptanceCriteria: string[];
  /** Potential risks */
  risks: string[];
  /** Items explicitly not included */
  outOfScope: string[];
  /** Dependencies on other plans or external factors */
  dependencies: string[];
}

/** Summary of a plan for listing */
export interface PlanSummary {
  id: string;
  title: string;
  status: PlanStatus;
  created: string;
  updated: string;
}

/** Valid state transitions for plans */
export interface PlanTransition {
  from: PlanStatus;
  to: PlanStatus;
}
