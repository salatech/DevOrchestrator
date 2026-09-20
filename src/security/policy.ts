import type { CommandPolicy, PolicyRule } from './types.js';
import {
  DEFAULT_SAFE_PATTERNS,
  DEFAULT_APPROVAL_PATTERNS,
  DEFAULT_BLOCKED_PATTERNS,
} from './defaults.js';
import { argvPrefix, hasShellMetacharacters, tokenizeCommand } from './parse.js';

export class CommandPolicyChecker {
  private rules: PolicyRule[];

  constructor(customPolicies?: Record<string, CommandPolicy>) {
    this.rules = this.buildRules(customPolicies);
  }

  private buildRules(customPolicies?: Record<string, CommandPolicy>): PolicyRule[] {
    const customRules: PolicyRule[] = customPolicies
      ? Object.entries(customPolicies).map(([pattern, policy]) => ({
          pattern,
          policy,
          reason: 'Custom policy',
        }))
      : [];

    return [
      ...customRules,
      ...DEFAULT_BLOCKED_PATTERNS,
      ...DEFAULT_APPROVAL_PATTERNS,
      ...DEFAULT_SAFE_PATTERNS,
    ];
  }

  private matchesPattern(command: string, tokens: string[], pattern: string): boolean {
    const normCommand = command.trim().toLowerCase();
    const normPattern = pattern.toLowerCase();
    const joined = argvPrefix(tokens);
    return (
      joined === normPattern ||
      joined.startsWith(`${normPattern} `) ||
      normCommand === normPattern ||
      normCommand.startsWith(`${normPattern} `)
    );
  }

  getPolicy(command: string): { policy: CommandPolicy; reason: string } {
    if (hasShellMetacharacters(command)) {
      return {
        policy: 'blocked',
        reason: 'Shell metacharacters are not allowed (command injection prevention)',
      };
    }

    let tokens: string[];
    try {
      tokens = tokenizeCommand(command);
    } catch {
      return { policy: 'blocked', reason: 'Malformed command' };
    }

    if (tokens.length === 0) {
      return { policy: 'blocked', reason: 'Empty command' };
    }

    for (const rule of this.rules) {
      if (this.matchesPattern(command, tokens, rule.pattern)) {
        return { policy: rule.policy, reason: rule.reason };
      }
    }

    return {
      policy: 'requires_approval',
      reason: 'Unknown command, default to requiring approval',
    };
  }
}
