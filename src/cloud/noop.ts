import type {
  AuthProvider,
  AuthSession,
  BillingClient,
  CloudClient,
  RemoteConfigProvider,
  RemoteSettings,
  UsageEvent,
  UsageReporter,
} from './types.js';

class DisabledAuth implements AuthProvider {
  async getSession(): Promise<AuthSession | null> {
    return null;
  }
}

class DisabledUsage implements UsageReporter {
  async report(_event: UsageEvent): Promise<void> {
    // Telemetry is off. Never send source, diffs, or secrets.
  }
}

class DisabledRemoteConfig implements RemoteConfigProvider {
  async getSettings(): Promise<RemoteSettings | null> {
    return null;
  }
}

class DisabledBilling implements BillingClient {
  isEnabled(): boolean {
    return false;
  }
}

/**
 * Local-only cloud client. Workspace, git, and agents never call a network
 * control plane through this implementation.
 */
export class NoopCloudClient implements CloudClient {
  readonly enabled = false;
  readonly auth = new DisabledAuth();
  readonly usage = new DisabledUsage();
  readonly config = new DisabledRemoteConfig();
  readonly billing = new DisabledBilling();
}

export function createCloudClient(): CloudClient {
  return new NoopCloudClient();
}
