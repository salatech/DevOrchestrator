import * as p from '@clack/prompts';
import pc from 'picocolors';
import { DevAIError } from '../errors/index.js';
import { redactSecrets } from '../logging/redact.js';

export function formatError(error: unknown): string {
  if (error instanceof DevAIError) {
    return redactSecrets(error.message);
  }
  if (error instanceof Error) {
    return redactSecrets(error.message);
  }
  return redactSecrets(String(error));
}

export function fail(error: unknown): never {
  p.log.error(pc.red(formatError(error)));
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
