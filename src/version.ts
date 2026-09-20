import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs';
import * as path from 'node:path';

declare const __DEVAI_VERSION__: string | undefined;

/**
 * Package version. Authoritative source is package.json.
 * The production bundle also injects __DEVAI_VERSION__ at build time.
 */
export function getVersion(): string {
  if (typeof __DEVAI_VERSION__ === 'string' && __DEVAI_VERSION__.length > 0) {
    return __DEVAI_VERSION__;
  }

  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.resolve(here, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string };
    if (pkg.version) return pkg.version;
  } catch {
    // fall through
  }

  try {
    const require = createRequire(import.meta.url);
    return (require('../package.json') as { version: string }).version;
  } catch {
    return '0.0.0';
  }
}

export const VERSION = getVersion();
