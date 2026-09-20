const KEY_LIKE =
  /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|passwd|authorization|private[_-]?key|client[_-]?secret)\s*[:=]\s*['"]?[^\s'"]+/gi;

const OPENAI_LIKE = /\bsk-[A-Za-z0-9_-]{8,}\b/g;
const ANTHROPIC_LIKE = /\bsk-ant-[A-Za-z0-9_-]{8,}\b/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._\-+/=]+/gi;
const PEM_BLOCK = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;

/**
 * Strip credentials from strings that may be logged or persisted.
 */
export function redactSecrets(value: string): string {
  return value
    .replace(PEM_BLOCK, '[REDACTED PRIVATE KEY]')
    .replace(ANTHROPIC_LIKE, '[REDACTED]')
    .replace(OPENAI_LIKE, '[REDACTED]')
    .replace(BEARER, 'Bearer [REDACTED]')
    .replace(KEY_LIKE, (match) => {
      const name = match.split(/[:=]/)[0];
      return `${name.trim()}=[REDACTED]`;
    });
}

export function redactEnv(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(env)) {
    if (raw === undefined) continue;
    if (/key|token|secret|password|passwd|credential|authorization/i.test(key)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = redactSecrets(raw);
    }
  }
  return result;
}
