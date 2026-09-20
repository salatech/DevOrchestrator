import { describe, it, expect } from 'vitest';
import { tokenizeCommand, hasShellMetacharacters } from '../../../src/security/parse.js';
import { CommandPolicyChecker } from '../../../src/security/policy.js';

describe('security/parse', () => {
  it('tokenizes quoted arguments without a shell', () => {
    expect(tokenizeCommand('git commit -m "hello world"')).toEqual([
      'git',
      'commit',
      '-m',
      'hello world',
    ]);
  });

  it('detects shell metacharacters outside quotes', () => {
    expect(hasShellMetacharacters('npm test; rm -rf /')).toBe(true);
    expect(hasShellMetacharacters('git commit -m "a;b"')).toBe(false);
  });
});

describe('security/policy injection', () => {
  const checker = new CommandPolicyChecker();

  it('blocks chained commands', () => {
    expect(checker.getPolicy('npm test; rm -rf /').policy).toBe('blocked');
    expect(checker.getPolicy('git status | sh').policy).toBe('blocked');
  });

  it('blocks destructive git', () => {
    expect(checker.getPolicy('git reset --hard').policy).toBe('blocked');
    expect(checker.getPolicy('sudo pnpm test').policy).toBe('blocked');
  });
});
