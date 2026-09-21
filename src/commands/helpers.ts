import * as p from '@clack/prompts';
import pc from 'picocolors';
import { DevAIError } from '../errors/index.js';
import { redactSecrets } from '../logging/redact.js';

export function formatError(error: unknown): string {
  if (error instanceof DevAIError) {
    return redactSecrets(withCause(error.message, error));
  }
  if (error instanceof Error) {
    return redactSecrets(withCause(error.message, error));
  }
  return redactSecrets(String(error));
}

function withCause(message: string, error: Error): string {
  const extra = formatCauseChain(error);
  if (!extra || message.includes(extra)) return message;
  return `${message}\n${extra}`;
}

function formatCauseChain(error: Error): string | undefined {
  const lines: string[] = [];
  let current: unknown = error.cause;
  const seen = new Set<unknown>([error]);
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const code = 'code' in current && typeof current.code === 'string' ? current.code : undefined;
    if (current instanceof Error) {
      const line =
        code && !current.message.includes(code) ? `${current.message} (${code})` : current.message;
      if (line && !lines.includes(line) && !error.message.includes(line)) lines.push(line);
      current = current.cause;
      continue;
    }
    if (code && !error.message.includes(code)) lines.push(code);
    break;
  }
  return lines.length > 0 ? lines.map((line) => `  ${line}`).join('\n') : undefined;
}

export function fail(error: unknown): never {
  const [first, ...rest] = formatError(error).split('\n');
  p.log.error(pc.red(first || 'Failed'));
  for (const line of rest) {
    if (line.trim()) p.log.message(line);
  }
  p.outro('Failed');
  process.exit(1);
}

export function splitList(value: unknown): string[] | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
