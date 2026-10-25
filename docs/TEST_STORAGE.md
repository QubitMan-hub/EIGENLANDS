# Tests without PostgreSQL

`npm test` probes the configured test PostgreSQL endpoint. When unavailable, server tests explicitly select the game's real `LocalDb`, `LocalRepo` and `LocalRepo34` browser adapters, with memory presence/bus/locks. No SQL parser or fabricated database results are used. Production startup still requires PostgreSQL and never silently falls back to memory.

- `npm run test:memory -w @eigenlands/server` forces the external-service-free suite.
- `TEST_STORAGE=postgres npm test` requires real PostgreSQL; connection or migration errors fail the run.
- `TEST_DB_URL` selects the test PostgreSQL endpoint. It must identify a disposable database: SQL test setup truncates test data.

The memory suite runs real HTTP/WebSocket rooms, inventory, crafting, combat, progression, trading, moderation audits, cave/boss rewards and app shutdown/restart checks. Accounts, characters, progress, shadows, objects, diffs, respawns and audit records use the browser adapter's actual contracts. Fixtures inspect each adapter's native audit records. Browser transactions clone and validate the whole trade, including its audit row, before writing any participant.

Two external-service-specific checks are visibly skipped in memory mode: PostgreSQL connection outage readiness and the Redis cluster-bus party test. Both remain mandatory in the PostgreSQL/Redis CI job. The separate memory CI job exercises the fallback without either service. Browser-store contract tests additionally cover JSON serialization failure rollback, account upgrades/deletion, foreign keys, float32 coordinates, deep copies and reopening the real unload journal.

The memory test store survives app recreation within a test process; it is not a durable multiplayer hosting backend. Actual IndexedDB solo save/reload and production PostgreSQL save/restart/export are verified separately by browser and Docker smoke tests.
