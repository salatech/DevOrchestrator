#!/usr/bin/env node
/**
 * Inspect `pnpm pack` output. Fails if development or secret paths leak into the tarball.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const root = process.cwd();
const dest = path.join(root, '.pack');
fs.mkdirSync(dest, { recursive: true });

execFileSync('pnpm', ['pack', '--pack-destination', dest], { stdio: 'inherit' });

const tarball = fs.readdirSync(dest).find((name) => name.endsWith('.tgz'));
if (!tarball) {
  console.error('No tarball produced');
  process.exit(1);
}

const listing = execFileSync('tar', ['-tzf', path.join(dest, tarball)], { encoding: 'utf8' });
const files = listing.split('\n').filter(Boolean);

const required = ['package/package.json', 'package/dist/cli.mjs', 'package/README.md'];
for (const file of required) {
  if (!files.includes(file) && !files.some((entry) => entry.startsWith(file))) {
    console.error(`Missing required package file: ${file}`);
    process.exit(1);
  }
}

const forbidden = [
  /^package\/\.env/,
  /^package\/tests\//,
  /^package\/src\//,
  /^package\/\.ai\/state\//,
  /^package\/\.ai\/runs\//,
  /credentials/i,
  /\.pem$/,
];

for (const file of files) {
  if (forbidden.some((pattern) => pattern.test(file))) {
    console.error(`Forbidden path in package: ${file}`);
    process.exit(1);
  }
}

console.log(`Package OK: ${tarball} (${files.length} entries)`);
