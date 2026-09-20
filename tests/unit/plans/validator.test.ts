import { describe, it, expect } from 'vitest';
import { validatePlan, validatePlanId } from '../../../src/plans/validator.js';
import type { Plan, PlanStatus } from '../../../src/plans/types.js';

describe('plans/validator', () => {
  describe('validatePlanId', () => {
    it('accepts valid plan IDs like PLAN-001, PLAN-999', () => {
      expect(validatePlanId('PLAN-001')).toBe(true);
      expect(validatePlanId('PLAN-999')).toBe(true);
      expect(validatePlanId('PLAN-123')).toBe(true);
    });

    it('rejects invalid plan IDs', () => {
      expect(validatePlanId('PLAN-1')).toBe(false);
      expect(validatePlanId('PLAN-ABCD')).toBe(false);
      expect(validatePlanId('plan-001')).toBe(false);
      expect(validatePlanId('invalid')).toBe(false);
    });
  });

  describe('validatePlan', () => {
    const validPlan: Plan = {
      id: 'PLAN-001',
      title: 'Valid Plan',
      status: 'draft' as PlanStatus,
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-01T00:00:00.000Z',
      objective: 'Objective',
      implementationSteps: [{ id: 'step-1', title: 'Step 1', description: 'desc', status: 'pending' }],
      acceptanceCriteria: ['Criteria 1'],
      currentState: '',
      relevantFiles: [],
      filesToModify: [],
      filesToCreate: [],
      constraints: [],
      testingStrategy: '',
      risks: [],
      outOfScope: [],
      dependencies: []
    };

    it('passes for valid plan', () => {
      expect(() => validatePlan(validPlan)).not.toThrow();
    });

    it('throws for missing id', () => {
      const plan = { ...validPlan, id: '' };
      expect(() => validatePlan(plan)).toThrow(/Invalid or missing plan id/);
    });

    it('throws for missing title', () => {
      const plan = { ...validPlan, title: '' };
      expect(() => validatePlan(plan)).toThrow(/Plan title is missing/);
    });

    it('throws for missing objective', () => {
      const plan = { ...validPlan, objective: '' };
      expect(() => validatePlan(plan)).toThrow(/Plan objective is missing/);
    });

    it('throws for empty steps', () => {
      const plan = { ...validPlan, implementationSteps: [] };
      expect(() => validatePlan(plan)).toThrow(/Plan implementationSteps is empty/);
    });

    it('throws for empty acceptance criteria', () => {
      const plan = { ...validPlan, acceptanceCriteria: [] };
      expect(() => validatePlan(plan)).toThrow(/Plan acceptanceCriteria is empty/);
    });
  });
});
