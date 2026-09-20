const SHELL_META = /[;&|`$<>\n]/;

/**
 * Split a command into argv without invoking a shell.
 * Supports single and double quotes. Does not expand variables.
 */
export function tokenizeCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }

  if (quote) {
    throw new Error('Unclosed quote in command');
  }
  if (current) tokens.push(current);
  return tokens;
}

export function hasShellMetacharacters(command: string): boolean {
  let quote: '"' | "'" | null = null;
  for (const ch of command) {
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (SHELL_META.test(ch)) return true;
  }
  return false;
}

export function argvPrefix(tokens: string[]): string {
  return tokens.join(' ').toLowerCase();
}
