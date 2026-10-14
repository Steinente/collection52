import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@collection52/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)) } },
  test: { include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'], coverage: { reporter: ['text', 'html'] } }
});
