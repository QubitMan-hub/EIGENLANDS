import { defineConfig, type Plugin } from 'vite';
import { resolve, sep } from 'node:path';

// GitHub Pages serves under /<repo>/ and has no game server: VITE_SOLO=1 builds the single-player variant that runs
// the real server room inside the browser (see src/local/).
const SOLO = process.env.VITE_SOLO === '1' || process.env.VITE_LOCAL === '1';
const LOCAL = resolve(__dirname, 'src/local');
const SERVER_SRC = resolve(__dirname, '../server/src');
const posix = (p: string) => p.split(sep).join('/');

/** Node-only packages the server code may import; never usable in the page. */
const NODE_ONLY = new Set(['pg', 'express', 'cors', 'google-auth-library', '@colyseus/ws-transport', '@colyseus/core', 'ws', 'colyseus.js/node']);
const STUB = '\0solo-node-stub:';

/**
 * Solo build plumbing:
 *  - `colyseus` (server package) → src/local/colyseus-shim.ts; `colyseus.js` (client SDK) → src/local/client.ts, except
 *    for src/local itself, which wraps the real SDK;
 *  - `node:crypto` → a synchronous browser implementation, `ioredis` → a stub (solo uses the in-memory presence/bus/locks);
 *  - other Node-only modules → stubs that throw if ever called (so they never end up in the bundle);
 *  - server modules that use the `process` or `Buffer` globals get a module-local import of a browser shim instead
 *    (nothing is added to the page's globals, so client libraries keep their browser code paths).
 */
function solo(): Plugin {
  const importerIsLocal = (importer?: string) => !!importer && posix(importer).startsWith(posix(LOCAL) + '/');
  return {
    name: 'eigenlands-solo',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source === 'colyseus') return resolve(LOCAL, 'colyseus-shim.ts');
      if (source === 'colyseus.js' && !importerIsLocal(importer)) return resolve(LOCAL, 'client.ts');
      if (source === 'node:crypto' || source === 'crypto') return resolve(LOCAL, 'shims/crypto.ts');
      if (source === 'ioredis') return resolve(LOCAL, 'shims/ioredis.ts');
      if (NODE_ONLY.has(source) || source.startsWith('node:')) return STUB + source;
      return null;
    },
    load(id) {
      if (!id.startsWith(STUB)) return null;
      const name = id.slice(STUB.length);
      if (name !== 'ws') this.warn(`"${name}" is Node-only; it is stubbed in the single-player build`);
      // any named import resolves to a function/proxy that throws when actually used
      return {
        code: `const fail = (p) => { throw new Error(${JSON.stringify(name)} + ': ' + p + ' is not available in the single-player browser build'); };
const make = (p) => new Proxy(function () {}, { get: (_t, k) => (k === 'then' || typeof k === 'symbol' ? undefined : make(p + '.' + String(k))), apply: () => fail(p), construct: () => fail(p) });
export default make(${JSON.stringify(name)});`,
        syntheticNamedExports: 'default',
      };
    },
    transform(code, id) {
      const file = posix(id.split('?')[0]!);
      if (!file.startsWith(posix(SERVER_SRC) + '/') || !/\.[cm]?ts$/.test(file)) return null;
      const head: string[] = [];
      const declares = (n: string) => new RegExp(`(?:const|let|var|class|function)\\s+${n}\\b|import\\s+${n}\\b|import\\s*(?:type\\s*)?\\{[^}]*\\b${n}\\b[^}]*\\}`).test(code);
      if (/\bprocess\.\w/.test(code) && !declares('process')) head.push(`import process from ${JSON.stringify(posix(resolve(LOCAL, 'shims/process.ts')))};`);
      if (/\bBuffer\b/.test(code) && !declares('Buffer')) head.push(`import { Buffer } from ${JSON.stringify(posix(resolve(LOCAL, 'shims/buffer.ts')))};`);
      return head.length ? { code: head.join('\n') + '\n' + code, map: null } : null;
    },
  };
}

/**
 * Normal (server) builds never contain the in-page server: src/local is only reachable through dead `VITE_SOLO`
 * branches, but Vite's dependency scanner would still crawl into it (and from there into Node-only server packages).
 */
function noSolo(): Plugin {
  const ID = '\0solo-disabled';
  return {
    name: 'eigenlands-no-solo',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !/(^|\/)local\//.test(source)) return null;
      const abs = posix(resolve(importer, '..', source));
      return abs.startsWith(posix(LOCAL) + '/') ? ID : null;
    },
    load(id) { return id === ID ? 'export const localFetch = () => { throw new Error("single-player mode is not part of this build"); };' : null; },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  server: { port: 5173, host: true },
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 1500 },
  esbuild: { tsconfigRaw: { compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false } } },
  plugins: SOLO ? [solo()] : [noSolo()],
  // the solo build reads VITE_SOLO through import.meta.env (also when only VITE_LOCAL is set)
  define: SOLO ? { 'import.meta.env.VITE_SOLO': JSON.stringify('1') } : {},
  optimizeDeps: SOLO ? { exclude: ['colyseus'] } : {},
});
