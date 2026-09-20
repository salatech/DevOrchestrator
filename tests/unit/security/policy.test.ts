import { describe, it, expect } from 'vitest';
import { CommandPolicyChecker } from '../../../src/security/policy.js';

describe('security/policy', () => {
  const checker = new CommandPolicyChecker({
    'custom command': 'blocked',
    'special safe': 'safe'
  });

  describe('Safe commands', () => {
    it('identifies safe commands', () => {
      expect(checker.getPolicy('npm test').policy).toBe('safe');
      expect(checker.getPolicy('pnpm lint').policy).toBe('safe');
      expect(checker.getPolicy('git status').policy).toBe('safe');
      expect(checker.getPolicy('git diff').policy).toBe('safe');
      expect(checker.getPolicy('tsc --noEmit').policy).toBe('safe');
    });
  });

  describe('Approval required', () => {
    it('identifies commands needing approval', () => {
      expect(checker.getPolicy('npm install foo').policy).toBe('requires_approval');
      expect(checker.getPolicy('git commit -m "msg"').policy).toBe('requires_approval');
      expect(checker.getPolicy('git push').policy).toBe('requires_approval');
    });
  });

  describe('Blocked commands', () => {
    it('identifies blocked commands', () => {
      expect(checker.getPolicy('rm -rf /').policy).toBe('blocked');
      expect(checker.getPolicy('DROP TABLE users').policy).toBe('blocked');
      expect(checker.getPolicy('git push --force').policy).toBe('blocked');
    });
  });

  describe('Unknown commands', () => {
    it('defaults to requires_approval', () => {
      expect(checker.getPolicy('some unknown random command').policy).toBe('requires_approval');
    });
  });

  describe('Custom policies', () => {
    it('overrides defaults or adds new ones', () => {
      expect(checker.getPolicy('custom command args').policy).toBe('blocked');
      expect(checker.getPolicy('special safe args').policy).toBe('safe');
    });
  });
});
