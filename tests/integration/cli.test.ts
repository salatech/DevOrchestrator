import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const root = process.cwd();
const cli = path.join(root, 'dist', 'cli.mjs');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  version: string;
};

function runCli(...args: string[]) {
  const outFile = path.join(
    os.tmpdir(),
    `devai-cli-${Date.now()}-${Math.random().toString(16).slice(2)}.log`,
  );
  const fd = fs.openSync(outFile, 'w');
  try {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd: root,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        NO_COLOR: '1',
        CI: '1',
        FORCE_COLOR: '0',
      },
      stdio: ['ignore', fd, fd],
    });
    fs.closeSync(fd);
    const output = fs.readFileSync(outFile, 'utf8');
    return { status: result.status, output, error: result.error };
  } finally {
    fs.rmSync(outFile, { force: true });
  }
}

describe('installed CLI artifact', () => {
  it('exists after pnpm build', () => {
    expect(fs.existsSync(cli)).toBe(true);
  });

  it('prints a version matching package.json', () => {
    const result = runCli('--version');
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.output).toContain(pkg.version);
  });

  it('prints help', () => {
    const result = runCli('--help');
    expect(result.status).toBe(0);
    expect(result.output).toMatch(/devorch/);
    expect(result.output).toMatch(/doctor/);
  });

  it('runs doctor without crashing', () => {
    const result = runCli('doctor');
    expect(result.output).toMatch(/Node\.js runtime/);
    expect(result.output).toMatch(/git available/);
  });
});
