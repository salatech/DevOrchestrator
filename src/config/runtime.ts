/**
 * Process-level runtime configuration.
 * Distinct from project `.ai/` config: this describes the installed CLI, not the repo.
 */

export type RuntimeEnvName = 'development' | 'test' | 'production';
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

export interface RuntimeConfig {
  env: RuntimeEnvName;
  logLevel: LogLevel;
  telemetryEnabled: boolean;
  cloudEndpoint?: string;
  commandTimeoutMs: number;
  minNodeMajor: number;
}

const MIN_NODE_MAJOR = 20;

function parseEnvName(value: string | undefined): RuntimeEnvName {
  if (value === 'production' || value === 'test' || value === 'development') return value;
  if (process.env.NODE_ENV === 'production') return 'production';
  if (process.env.NODE_ENV === 'test') return 'test';
  return 'development';
}

function parseLogLevel(value: string | undefined, env: RuntimeEnvName): LogLevel {
  if (
    value === 'silent' ||
    value === 'error' ||
    value === 'warn' ||
    value === 'info' ||
    value === 'debug'
  ) {
    return value;
  }
  return env === 'production' ? 'info' : 'info';
}

export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const runtimeEnv = parseEnvName(env.DEVAI_ENV);
  const timeout = Number.parseInt(env.DEVAI_COMMAND_TIMEOUT_MS ?? '', 10);

  return {
    env: runtimeEnv,
    logLevel: parseLogLevel(env.DEVAI_LOG_LEVEL, runtimeEnv),
    telemetryEnabled: env.DEVAI_TELEMETRY === '1' || env.DEVAI_TELEMETRY === 'true',
    cloudEndpoint: env.DEVAI_CLOUD_ENDPOINT?.trim() || undefined,
    commandTimeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 120_000,
    minNodeMajor: MIN_NODE_MAJOR,
  };
}

export function getNodeMajor(version: string = process.versions.node): number {
  return Number.parseInt(version.split('.')[0] ?? '0', 10);
}

export function isSupportedNode(version: string = process.versions.node): boolean {
  return getNodeMajor(version) >= MIN_NODE_MAJOR;
}
