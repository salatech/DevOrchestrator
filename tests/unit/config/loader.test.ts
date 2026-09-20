import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveApiKey } from '../../../src/config/loader.js';

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
