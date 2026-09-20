import { describe, it, expect } from 'vitest';
import { redactSecrets } from '../../../src/logging/redact.js';

describe('logging/redact', () => {
  it('redacts key-like assignments and provider tokens', () => {
    const raw = 'OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz Authorization: Bearer abc.def';
    const redacted = redactSecrets(raw);
    expect(redacted).not.toContain('sk-abcdefghijklmnopqrstuvwxyz');
    expect(redacted).not.toContain('abc.def');
    expect(redacted).toContain('[REDACTED]');
  });
});
