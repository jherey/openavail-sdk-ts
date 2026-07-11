import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/bin.ts'],
    format: ['esm'],
    clean: false,
    dts: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  {
    entry: ['src/registry.ts'],
    format: ['esm'],
    clean: false,
    dts: true,
  },
]);
