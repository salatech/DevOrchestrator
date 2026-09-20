import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  outExtension: () => ({ js: '.mjs' }),
  clean: true,
  minify: false,
  sourcemap: true,
  dts: false,
  treeshake: true,
  splitting: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  define: {
    __DEVAI_VERSION__: JSON.stringify(pkg.version),
  },
  external: [
    'simple-git',
    'ai',
    '@ai-sdk/openai',
    '@ai-sdk/anthropic',
    'execa',
  ],
});
