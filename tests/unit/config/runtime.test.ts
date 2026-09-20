import { describe, it, expect } from 'vitest';
import { loadRuntimeConfig, isSupportedNode } from '../../../src/config/runtime.js';

describe('config/runtime', () => {
  it('defaults to local-first settings with telemetry off', () => {
    const config = loadRuntimeConfig({
      NODE_ENV: 'test',
    } as NodeJS.ProcessEnv);
    expect(config.env).toBe('test');
    expect(config.telemetryEnabled).toBe(false);
    expect(config.cloudEndpoint).toBeUndefined();
    expect(config.minNodeMajor).toBe(20);
  });

  it('enables telemetry only when explicitly requested', () => {
    const config = loadRuntimeConfig({ DEVAI_TELEMETRY: '1' } as NodeJS.ProcessEnv);
    expect(config.telemetryEnabled).toBe(true);
  });

  it('accepts Node 20+', () => {
    expect(isSupportedNode('20.0.0')).toBe(true);
    expect(isSupportedNode('18.20.0')).toBe(false);
  });
});
