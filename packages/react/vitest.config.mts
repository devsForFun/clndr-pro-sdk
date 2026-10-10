import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Same mapping as tsconfig `paths`: run against the SDK source, so the
    // tests don't need packages/sdk to be built first (or a stale dist/).
    alias: {
      '@clndr-pro/sdk': fileURLToPath(new URL('../sdk/src/index.ts', import.meta.url)),
    },
  },
});
