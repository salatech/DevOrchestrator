import { describe, it, expect } from 'vitest';
import { formatError } from '../../../src/commands/helpers.js';
import { PlanningError } from '../../../src/errors/index.js';

describe('commands/helpers formatError', () => {
  it('includes the cause chain so "fetch failed" is not the only line', () => {
    const overflow = Object.assign(new Error('Headers Overflow Error'), {
      code: 'UND_ERR_HEADERS_OVERFLOW',
    });
    const error = new TypeError('fetch failed', { cause: overflow });
    const text = formatError(error);
    expect(text).toContain('fetch failed');
    expect(text).toContain('UND_ERR_HEADERS_OVERFLOW');
  });

  it('prints PlanningError messages as-is', () => {
    expect(formatError(new PlanningError('Plan not found: PLAN-001'))).toBe(
      'Plan not found: PLAN-001',
    );
  });
});
