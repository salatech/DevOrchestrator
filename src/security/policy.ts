import type { CommandPolicy, PolicyRule } from './types.js';
import { DEFAULT_SAFE_PATTERNS, DEFAULT_APPROVAL_PATTERNS, DEFAULT_BLOCKED_PATTERNS } from './defaults.js';

export class CommandPolicyChecker {
  private rules: PolicyRule[];

  constructor(customPolicies?: Record<string, CommandPolicy>) {
    this.rules = this.buildRules(customPolicies);
  }

  private buildRules(customPolicies?: Record<string, CommandPolicy>): PolicyRule[] {
    const customRules: PolicyRule[] = customPolicies ? Object.entries(customPolicies).map(([pattern, policy]) => ({
      pattern, policy, reason: 'Custom policy'
    })) : [];
    
    return [
      ...customRules,
      ...DEFAULT_BLOCKED_PATTERNS,
      ...DEFAULT_APPROVAL_PATTERNS,
      ...DEFAULT_SAFE_PATTERNS
    ];
  }

  private matchesPattern(command: string, pattern: string): boolean {
    const normCommand = command.trim().toLowerCase();
    const normPattern = pattern.toLowerCase();
    return normCommand.startsWith(normPattern) || normCommand.includes(normPattern);
  }

  getPolicy(command: string): { policy: CommandPolicy; reason: string } {
    for (const rule of this.rules) {
      if (this.matchesPattern(command, rule.pattern)) {
        return { policy: rule.policy, reason: rule.reason };
      }
    }
    return { policy: 'requires_approval', reason: 'Unknown command, default to requiring approval' };
  }
}
