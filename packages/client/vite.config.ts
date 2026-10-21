import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// GitHub Pages serves under /<repo>/ and has no game server: VITE_SOLO=1 builds the single-player variant that runs
// the real server logic inside the browser (see src/local/).
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  server: { port: 5173, host: true },
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 1500 },
  esbuild: { tsconfigRaw: { compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false } } },
  resolve: {
    alias: process.env.VITE_SOLO === '1' || process.env.VITE_LOCAL === '1' ? {
      // the browser build hosts the server room in-process: swap node-only modules for browser shims
      colyseus: resolve(__dirname, 'src/local/colyseus-shim.ts'),
    } : {},
  },
});
