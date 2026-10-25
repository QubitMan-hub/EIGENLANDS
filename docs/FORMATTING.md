# Source formatting and lint policy

Use Node 22 and run `npm ci`. `npm run format` applies Prettier across existing source, tests, tools, docs and config; `npm run format:check` and `npm run lint` are mandatory CI checks. This change includes the legacy formatting migration instead of excluding old source files.

Prettier targets 120 columns, two spaces and single-quoted JavaScript/TypeScript. ESLint enforces a 120-column limit for executable code, with explicit length exceptions for comments, URLs, string/template literals and regex literals so shader/data strings retain their contents. Generated build output, dependencies, coverage, local Claude worktrees and test-result directories are excluded. The lockfile stays npm-generated.

ESLint's recommended correctness rules cover the repository using the TypeScript parser. TypeScript remains responsible for name resolution and declaration merging. Unused declarations are outside this policy; unused value assignments are checked. Intentional control-character sanitizers have local, explained lint exceptions. Lint warnings fail CI.

The mechanical migration changes many lines without redesigning systems. Behavioral changes—boss/art, hydrology/materials and browser-store contracts—are documented separately and require their relevant tests and browser checks.
