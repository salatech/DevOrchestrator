import { describe, it, expect } from 'vitest';
import { serializePlan } from '../../../src/plans/serializer.js';
import { parsePlanFile } from '../../../src/plans/parser.js';
import type { Plan, PlanStatus } from '../../../src/plans/types.js';

describe('plans/serializer', () => {
  const samplePlan: Plan = {
    id: 'PLAN-001',
    title: 'Test Plan',
    status: 'draft' as PlanStatus,
    created: '2026-01-01',
    updated: '2026-01-02',
    planner: 'test-planner',
    objective: 'Test objective',
    currentState: '',
    relevantFiles: ['foo.ts'],
    filesToModify: [],
    filesToCreate: [],
    implementationSteps: [
      { id: 'step-1', title: 'Step 1', description: 'Desc 1', status: 'pending' }
    ],
    constraints: [],
    testingStrategy: '',
    acceptanceCriteria: ['Must work'],
    risks: [],
    outOfScope: [],
    dependencies: []
  };

  it('serializes a Plan then parses it back (round-trip)', () => {
    const serialized = serializePlan(samplePlan);
    const parsed = parsePlanFile(serialized);

    expect(parsed.id).toBe(samplePlan.id);
    expect(parsed.title).toBe(samplePlan.title);
    expect(parsed.status).toBe(samplePlan.status);
    expect(parsed.objective).toBe(samplePlan.objective);
    expect(parsed.relevantFiles).toEqual(samplePlan.relevantFiles);
    expect(parsed.implementationSteps[0].title).toBe(samplePlan.implementationSteps[0].title);
    expect(parsed.acceptanceCriteria).toEqual(samplePlan.acceptanceCriteria);
  });

  it('skips empty sections', () => {
    const serialized = serializePlan(samplePlan);
    expect(serialized).not.toContain('# Constraints');
    expect(serialized).not.toContain('# Files To Modify');
    expect(serialized).not.toContain('# Testing Strategy');
  });

  it('includes all non-empty sections', () => {
    const serialized = serializePlan(samplePlan);
    expect(serialized).toContain('# Objective');
    expect(serialized).toContain('# Relevant Files');
    expect(serialized).toContain('# Implementation Steps');
    expect(serialized).toContain('# Acceptance Criteria');
  });

  it('generates valid YAML frontmatter', () => {
    const serialized = serializePlan(samplePlan);
    expect(serialized.startsWith('---')).toBe(true);
    expect(serialized).toContain('id: PLAN-001');
    expect(serialized).toContain('title: Test Plan');
    expect(serialized).toContain('status: draft');
  });
});
