import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { PlanManager } from '../../../src/plans/manager.js';
import { PlanStatus } from '../../../src/plans/types.js';
import type { Plan } from '../../../src/plans/types.js';

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'PLAN-001',
    title: 'Add tests',
    status: PlanStatus.AwaitingApproval,
    created: '2026-09-20',
    updated: '2026-09-20',
    planner: 'test',
    branch: 'main',
    objective: 'Add coverage for the plan manager',
    currentState: '',
    relevantFiles: [],
    filesToModify: ['src/plans/manager.ts'],
    filesToCreate: [],
    implementationSteps: [{ number: 1, title: 'Write tests', description: 'Cover CRUD' }],
    constraints: [],
    testingStrategy: 'unit tests',
    acceptanceCriteria: ['Plans round-trip through disk'],
    risks: [],
    outOfScope: [],
    dependencies: [],
    ...overrides,
  };
}

describe('plans/manager', () => {
  let dir: string;
  let manager: PlanManager;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'devai-plans-'));
    manager = new PlanManager(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('creates, lists, loads, and transitions a plan', async () => {
    await manager.createPlan(makePlan());
    const listed = await manager.listPlans();
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe('PLAN-001');

    const loaded = await manager.loadPlan('PLAN-001');
    expect(loaded.objective).toContain('plan manager');

    const approved = await manager.transitionStatus('PLAN-001', PlanStatus.Approved);
    expect(approved.status).toBe(PlanStatus.Approved);
    expect(await manager.getNextId()).toBe('PLAN-002');
  });
});
