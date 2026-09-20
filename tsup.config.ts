import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  outExtension: () => ({ js: '.mjs' }),
  clean: true,
  minify: false,
  sourcemap: true,
  dts: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
  external: [
    'simple-git',
    'ai',
    '@ai-sdk/openai',
    '@ai-sdk/anthropic',
    'execa',
  ],
});
