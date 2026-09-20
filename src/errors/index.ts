/**
 * Base error class for all DevOrchestrator errors.
 * Includes an error code and optional context for debugging.
 */
export class DevAIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DevAIError';
  }
}

/**
 * Error thrown during plan generation or management.
 */
export class PlanningError extends DevAIError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'PLANNING_ERROR', context);
    this.name = 'PlanningError';
  }
}

/**
 * Error thrown during agent task execution.
 */
export class ExecutionError extends DevAIError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'EXECUTION_ERROR', context);
    this.name = 'ExecutionError';
  }
}

/**
 * Error thrown during plan or code validation.
 */
export class ValidationError extends DevAIError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when configuration is invalid or missing.
 */
export class ConfigError extends DevAIError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', context);
    this.name = 'ConfigError';
  }
}

/**
 * Error thrown during workspace inspection or file operations.
 */
export class WorkspaceError extends DevAIError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'WORKSPACE_ERROR', context);
    this.name = 'WorkspaceError';
  }
}

/**
 * Error thrown when a security policy is violated.
 */
export class SecurityError extends DevAIError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SECURITY_ERROR', context);
    this.name = 'SecurityError';
  }
}

/**
 * Error thrown when an LLM provider request fails.
 */
export class ProviderError extends DevAIError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'PROVIDER_ERROR', context);
    this.name = 'ProviderError';
  }
}

/**
 * Error thrown during context assembly or relevance scoring.
 */
export class ContextError extends DevAIError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONTEXT_ERROR', context);
    this.name = 'ContextError';
  }
}
