import { generateText, generateObject, type LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { ZodSchema } from 'zod';
import type { LLMRequest, LLMResponse, TokenUsage } from './types.js';
import { UsageTracker } from './usage-tracker.js';
import { ProviderError } from '../errors/index.js';
import type { DevAIConfig } from '../config/types.js';
import type { ProviderName } from './types.js';
import { resolveApiKey } from '../config/loader.js';

export type ModelRole = 'planner' | 'reviewer' | 'executor';

/**
 * Model orchestrator wrapping Vercel AI SDK.
 */
export class ModelOrchestrator {
  private usageTracker: UsageTracker;

  constructor(private config: DevAIConfig) {
    this.usageTracker = new UsageTracker();
  }

  async generate(role: ModelRole, request: LLMRequest): Promise<LLMResponse> {
    const { providerName, modelName, model } = await this.resolveModel(role);

    try {
      const result = await generateText({
        model,
        system: request.systemPrompt,
        messages: request.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
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

  async generateStructured<T>(
    role: ModelRole,
    request: LLMRequest,
    schema: ZodSchema<T>,
  ): Promise<{ object: T; usage: TokenUsage }> {
    const { providerName, modelName, model } = await this.resolveModel(role);

    try {
      const result = await generateObject({
        model,
        system: request.systemPrompt,
        messages: request.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
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

  getUsageSummary() {
    return this.usageTracker.getSummary();
  }

  resetUsage(): void {
    this.usageTracker.reset();
  }

  private getRoleConfig(role: ModelRole): { provider: ProviderName; model: string } {
    if (role === 'planner') return this.config.planner;
    if (role === 'reviewer') return this.config.reviewer;
    return {
      provider: this.config.executor.provider ?? this.config.planner.provider,
      model: this.config.executor.model ?? this.config.planner.model,
    };
  }

  private async resolveModel(role: ModelRole): Promise<{
    providerName: ProviderName;
    modelName: string;
    model: LanguageModel;
  }> {
    const providerConfig = this.getRoleConfig(role);
    const providerName = providerConfig.provider;
    const modelName = providerConfig.model;

    switch (providerName) {
      case 'openai': {
        const apiKey = resolveApiKey('openai');
        if (!apiKey) {
          throw new ProviderError('Missing API key for openai. Set OPENAI_API_KEY and retry.', {
            provider: providerName,
            model: modelName,
          });
        }
        const openai = createOpenAI({ apiKey });
        return { providerName, modelName, model: openai(modelName) };
      }
      case 'anthropic': {
        const apiKey = resolveApiKey('anthropic');
        if (!apiKey) {
          throw new ProviderError(
            'Missing API key for anthropic. Set ANTHROPIC_API_KEY and retry.',
            { provider: providerName, model: modelName },
          );
        }
        const anthropic = createAnthropic({ apiKey });
        return { providerName, modelName, model: anthropic(modelName) };
      }
      case 'google': {
        const apiKey = resolveApiKey('google');
        if (!apiKey) {
          throw new ProviderError(
            'Missing API key for google. Set GOOGLE_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY and retry.',
            { provider: providerName, model: modelName },
          );
        }
        const google = createGoogleGenerativeAI({ apiKey });
        return { providerName, modelName, model: google(modelName) };
      }
      default:
        throw new ProviderError(`Unsupported provider: ${providerName}`, {
          provider: providerName,
        });
    }
  }
}
