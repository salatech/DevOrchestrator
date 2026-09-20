import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { resolveApiKey, loadConfig } from '../../../src/config/loader.js';

describe('config/loader', () => {
  describe('resolveApiKey', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('returns OPENAI_API_KEY for openai', () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';
      expect(resolveApiKey('openai')).toBe('test-openai-key');
    });

    it('returns ANTHROPIC_API_KEY for anthropic', () => {
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      expect(resolveApiKey('anthropic')).toBe('test-anthropic-key');
    });

    it('returns undefined when no key set', () => {
      delete process.env.OPENAI_API_KEY;
      expect(resolveApiKey('openai')).toBeUndefined();
    });

    it('returns google keys correctly', () => {
      process.env.GOOGLE_API_KEY = 'google-key';
      expect(resolveApiKey('google')).toBe('google-key');

      delete process.env.GOOGLE_API_KEY;
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'google-genai-key';
      expect(resolveApiKey('google')).toBe('google-genai-key');
    });
  });

  describe('loadConfig', () => {
    let dir: string;
    const originalEnv = process.env;

    beforeEach(async () => {
      process.env = { ...originalEnv };
      delete process.env.DEVAI_PLANNER_PROVIDER;
      delete process.env.DEVAI_PLANNER_MODEL;
      delete process.env.DEVAI_EXECUTOR_AGENT;
      delete process.env.DEVAI_REVIEWER_PROVIDER;
      delete process.env.DEVAI_REVIEWER_MODEL;
      delete process.env.DEVAI_MAX_ITERATIONS;
      dir = await mkdtemp(path.join(tmpdir(), 'devai-config-'));
    });

    afterEach(async () => {
      process.env = originalEnv;
      await rm(dir, { recursive: true, force: true });
    });

    it('loads .ai/.devai.json', async () => {
      await mkdir(path.join(dir, '.ai'));
      await writeFile(
        path.join(dir, '.ai', '.devai.json'),
        JSON.stringify({
          planner: { provider: 'anthropic', model: 'claude-sonnet-4-5' },
          executor: { agent: 'llm' },
        }),
      );

      const config = await loadConfig(dir);
      expect(config.planner.provider).toBe('anthropic');
      expect(config.planner.model).toBe('claude-sonnet-4-5');
      expect(config.executor.agent).toBe('llm');
      expect(config.limits.maxIterations).toBe(3);
    });

    it('prefers root .devai.json over .ai/.devai.json', async () => {
      await mkdir(path.join(dir, '.ai'));
      await writeFile(
        path.join(dir, '.ai', '.devai.json'),
        JSON.stringify({ planner: { model: 'from-ai-dir' } }),
      );
      await writeFile(
        path.join(dir, '.devai.json'),
        JSON.stringify({ planner: { model: 'from-root' } }),
      );

      const config = await loadConfig(dir);
      expect(config.planner.model).toBe('from-root');
    });
  });
});

describe('config/loader', () => {
  describe('resolveApiKey', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('returns OPENAI_API_KEY for openai', () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';
      expect(resolveApiKey('openai')).toBe('test-openai-key');
    });

    it('returns ANTHROPIC_API_KEY for anthropic', () => {
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      expect(resolveApiKey('anthropic')).toBe('test-anthropic-key');
    });

    it('returns undefined when no key set', () => {
      delete process.env.OPENAI_API_KEY;
      expect(resolveApiKey('openai')).toBeUndefined();
    });

    it('returns google keys correctly', () => {
      process.env.GOOGLE_API_KEY = 'google-key';
      expect(resolveApiKey('google')).toBe('google-key');

      delete process.env.GOOGLE_API_KEY;
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'google-genai-key';
      expect(resolveApiKey('google')).toBe('google-genai-key');
    });
  });
});
