/** Message role in a conversation */
export type MessageRole = 'system' | 'user' | 'assistant';

/** A message in a conversation */
export interface Message {
  role: MessageRole;
  content: string;
}

/** Token usage information */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Request to an LLM provider */
export interface LLMRequest {
  /** System prompt */
  systemPrompt: string;
  /** Conversation messages */
  messages: Message[];
  /** Temperature (0-2) */
  temperature?: number;
  /** Maximum output tokens */
  maxTokens?: number;
  /** Response format */
  responseFormat?: 'text' | 'json';
}

/** Response from an LLM provider */
export interface LLMResponse {
  /** Generated content */
  content: string;
  /** Token usage */
  usage: TokenUsage;
  /** Model identifier */
  model: string;
  /** Provider name */
  provider: string;
  /** Reason the model stopped */
  finishReason: string;
}

/** Usage summary across multiple calls */
export interface UsageSummary {
  /** Usage per role (planner, executor, reviewer) */
  byRole: Record<string, TokenUsage>;
  /** Total usage */
  total: TokenUsage;
  /** Estimated cost in USD */
  estimatedCostUsd: number;
}

/** Supported provider names */
export type ProviderName = 'openai' | 'anthropic' | 'google';

/** Model tier for routing */
export type ModelTier = 'fast' | 'reasoning' | 'coding';
