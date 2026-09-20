import type { TokenUsage, UsageSummary } from './types.js';

/**
 * Tracks token usage.
 */
export class UsageTracker {
  private usageByRole: Map<string, TokenUsage> = new Map();

  /** Record usage for a role */
  record(role: string, usage: TokenUsage): void {
    const existing = this.usageByRole.get(role) ?? { inputTokens: 0, outputTokens: 0 };
    this.usageByRole.set(role, {
      inputTokens: existing.inputTokens + usage.inputTokens,
      outputTokens: existing.outputTokens + usage.outputTokens,
    });
  }

  /** Get usage summary */
  getSummary(): UsageSummary {
    const byRole: Record<string, TokenUsage> = {};
    let totalInput = 0;
    let totalOutput = 0;
    
    for (const [role, usage] of this.usageByRole) {
      byRole[role] = { ...usage };
      totalInput += usage.inputTokens;
      totalOutput += usage.outputTokens;
    }
    
    return {
      byRole,
      total: { inputTokens: totalInput, outputTokens: totalOutput },
      estimatedCostUsd: this.estimateCost(totalInput, totalOutput),
    };
  }

  /** Reset all usage tracking */
  reset(): void {
    this.usageByRole.clear();
  }

  /** Rough cost estimate (approximate, based on typical pricing) */
  private estimateCost(inputTokens: number, outputTokens: number): number {
    // Rough average: $3/M input, $15/M output (GPT-4o pricing)
    const inputCost = (inputTokens / 1_000_000) * 3;
    const outputCost = (outputTokens / 1_000_000) * 15;
    return Math.round((inputCost + outputCost) * 100) / 100;
  }
}
