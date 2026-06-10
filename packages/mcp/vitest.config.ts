import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@openavail/sdk': resolve(__dirname, '../sdk/src/index.ts'),
    },
  },
});
