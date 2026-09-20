/**
 * Optional cloud control-plane contracts.
 *
 * These exist so a future hosted product can plug in without changing the
 * local orchestration loop. The local runtime must not require any of them
 * to inspect a workspace, plan, execute, validate, or review.
 */

export interface AuthSession {
  accountId: string;
  displayName?: string;
}

export interface UsageEvent {
  role: 'planner' | 'executor' | 'reviewer';
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

export interface RemoteSettings {
  planner?: { provider?: string; model?: string };
  reviewer?: { provider?: string; model?: string };
  executor?: { agent?: string };
}

export interface AuthProvider {
  getSession(): Promise<AuthSession | null>;
}

export interface UsageReporter {
  report(event: UsageEvent): Promise<void>;
}

export interface RemoteConfigProvider {
  getSettings(): Promise<RemoteSettings | null>;
}

export interface BillingClient {
  isEnabled(): boolean;
}

export interface CloudClient {
  readonly enabled: boolean;
  auth: AuthProvider;
  usage: UsageReporter;
  config: RemoteConfigProvider;
  billing: BillingClient;
}
