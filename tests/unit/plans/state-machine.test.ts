import { describe, it, expect } from 'vitest';
import { isValidTransition, validateTransition, isTerminalStatus, getValidNextStatuses } from '../../../src/plans/state-machine.js';
import type { PlanStatus } from '../../../src/plans/types.js';

describe('plans/state-machine', () => {
  describe('isValidTransition', () => {
    it('allows valid transitions', () => {
      expect(isValidTransition('draft', 'awaiting_approval')).toBe(true);
      expect(isValidTransition('awaiting_approval', 'approved')).toBe(true);
      expect(isValidTransition('approved', 'executing')).toBe(true);
    });

    it('blocks invalid transitions', () => {
      expect(isValidTransition('draft', 'completed')).toBe(false);
      expect(isValidTransition('completed', 'draft')).toBe(false);
      expect(isValidTransition('cancelled', 'executing')).toBe(false);
    });
  });

  describe('validateTransition', () => {
    it('does not throw on valid transition', () => {
      expect(() => validateTransition('draft', 'awaiting_approval')).not.toThrow();
    });

    it('throws on invalid transition', () => {
      expect(() => validateTransition('draft', 'completed')).toThrow(/Invalid transition/);
    });
  });

  describe('isTerminalStatus', () => {
    it('returns true for terminal statuses', () => {
      expect(isTerminalStatus('completed')).toBe(true);
      expect(isTerminalStatus('cancelled')).toBe(true);
    });

    it('returns false for non-terminal statuses', () => {
      expect(isTerminalStatus('draft')).toBe(false);
      expect(isTerminalStatus('executing')).toBe(false);
    });
  });

  describe('getValidNextStatuses', () => {
    it('returns correct options for each status', () => {
      expect(getValidNextStatuses('draft')).toEqual(['awaiting_approval']);
      expect(getValidNextStatuses('completed')).toEqual([]);
      expect(getValidNextStatuses('failed')).toEqual(['draft']);
      expect(getValidNextStatuses('executing')).toEqual(['validating', 'failed', 'cancelled']);
    });
  });
});
