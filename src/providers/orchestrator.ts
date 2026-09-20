import { generateText, generateObject, type LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { ZodSchema } from 'zod';
import type { LLMRequest, LLMResponse, TokenUsage } from './types.js';
import { UsageTracker } from './usage-tracker.js';
import { ProviderError } from '../errors/index.js';
import type { DevAIConfig } from '../config/types.js';

/**
 * Model orchestrator wrapping Vercel AI SDK.
 */
export class ModelOrchestrator {
  private usageTracker: UsageTracker;

  constructor(private config: DevAIConfig) {
    this.usageTracker = new UsageTracker();
  }

  /**
   * Generate text using the model assigned to a given role.
   */
  async generate(role: 'planner' | 'reviewer', request: LLMRequest): Promise<LLMResponse> {
    const model = this.resolveModel(role);
    const providerName = role === 'planner' ? this.config.planner.provider : this.config.reviewer.provider;
    const modelName = role === 'planner' ? this.config.planner.model : this.config.reviewer.model;
    
    try {
      const result = await generateText({
        model,
        system: request.systemPrompt,
        messages: request.messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        temperature: request.temperature,
        maxTokens: request.maxTokens,
      });
      
      const usage: TokenUsage = {
        inputTokens: result.usage?.promptTokens ?? 0,
        outputTokens: result.usage?.completionTokens ?? 0,
      };
      
      this.usageTracker.record(role, usage);
      
      return {
        content: result.text,
        usage,
        model: modelName,
        provider: providerName,
        finishReason: result.finishReason ?? 'unknown',
      };
    } catch (error) {
      throw new ProviderError(
        `Failed to generate with ${providerName}/${modelName}: ${error instanceof Error ? error.message : String(error)}`,
        { role, provider: providerName, model: modelName },
      );
    }
  }

  /**
   * Generate a structured object using Zod schema.
   */
  async generateStructured<T>(
    role: 'planner' | 'reviewer',
    request: LLMRequest,
    schema: ZodSchema<T>,
  ): Promise<{ object: T; usage: TokenUsage }> {
    const model = this.resolveModel(role);
    const providerName = role === 'planner' ? this.config.planner.provider : this.config.reviewer.provider;
    const modelName = role === 'planner' ? this.config.planner.model : this.config.reviewer.model;
    
    try {
      const result = await generateObject({
        model,
        system: request.systemPrompt,
        messages: request.messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        schema,
        temperature: request.temperature,
      });
      
      const usage: TokenUsage = {
        inputTokens: result.usage?.promptTokens ?? 0,
        outputTokens: result.usage?.completionTokens ?? 0,
      };
      
      this.usageTracker.record(role, usage);
      
      return { object: result.object, usage };
    } catch (error) {
      throw new ProviderError(
        `Failed to generate structured output with ${providerName}/${modelName}: ${error instanceof Error ? error.message : String(error)}`,
        { role, provider: providerName, model: modelName },
      );
    }
  }

  /** Get accumulated usage summary */
  getUsageSummary() {
    return this.usageTracker.getSummary();
  }

  /** Reset usage tracking */
  resetUsage(): void {
    this.usageTracker.reset();
  }

  /**
   * Resolve the LanguageModel instance for a given role.
   */
  private resolveModel(role: 'planner' | 'reviewer'): LanguageModel {
    const providerConfig = role === 'planner' ? this.config.planner : this.config.reviewer;
    
    switch (providerConfig.provider) {
      case 'openai': {
        const openai = createOpenAI({});
        return openai(providerConfig.model);
      }
      case 'anthropic': {
        const anthropic = createAnthropic({});
        return anthropic(providerConfig.model);
      }
      default:
        throw new ProviderError(
          `Unsupported provider: ${providerConfig.provider}`,
          { provider: providerConfig.provider },
        );
    }
  }
}
