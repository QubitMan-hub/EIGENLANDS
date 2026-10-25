import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
  esbuild: { tsconfigRaw: { compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false } } },
});
