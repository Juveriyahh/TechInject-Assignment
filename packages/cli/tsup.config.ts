import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { cli: 'src/cli.ts', index: 'src/index.ts' },
  format: ['esm'],
  target: 'node20',
  dts: true,
  clean: true,
  // The shared workspace package ships TypeScript sources, so it is bundled in.
  noExternal: ['@tech-inject/shared'],
  banner: { js: '#!/usr/bin/env node' }
});
