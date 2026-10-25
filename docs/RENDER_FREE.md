# Free Render multiplayer trial

This setup is **$0 for temporary testing**, using exactly one free Docker web service and one free PostgreSQL database in **Singapore**. It keeps the existing GitHub Pages game frontend. There are no paid plans, persistent disks, Redis services, cron jobs or workers in `render.yaml`.

It does **not** provide a permanent world or guaranteed smooth play for 20 friends. Render's free service sleeps after 15 minutes without incoming traffic; waking can take about a minute. Friends who remain connected can keep playing when the owner's computer is off. PostgreSQL retains progress through normal web-service restarts/sleep, but **the free database expires after 30 days**. Free databases have no managed backup/recovery feature. Export important saves before expiry.

## Deploy

[Deploy the free blueprint](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2FQubitMan-hub%2FEIGENLANDS)

1. Sign in to Render and authorize access to `QubitMan-hub/EIGENLANDS`. Creating the resources requires the owner's Render account; this chat has no connected Render credentials.
2. Choose the repository's `main` branch and its root `render.yaml` blueprint.
3. Review **both** resources: `eigenlands-server` must be **Free**, and `eigenlands-db` must be **Free**. Both should use Singapore. Do not select a paid fallback if free resources are unavailable. The resources' names may gain a suffix to avoid a collision.
4. Apply the blueprint. Render creates the database, supplies its private URL and generates a stable session secret. The game applies its existing SQL migrations on startup and uses `/readyz` for database-aware readiness. The web service terminates HTTPS/WebSockets at Render's ingress.
5. Wait until the server is healthy, then copy its public **https://…onrender.com** address. Opening `<server-address>/readyz` should return `{"ok":true}`. This backend URL is not the game page.
6. Open [EIGENLANDS](https://qubitman-hub.github.io/EIGENLANDS/), expand **Play with friends**, paste the backend URL and choose **Join server**. Name your character and select Play. Use **Copy friend invite** to share the same world.

Solo saves remain separate from the online world. Online guests retain their login in that browser, scoped to the server URL. Keep the same web-service address, session secret, database and world seed to retain that world identity. Clearing browser storage loses a guest's login. Google sign-in is optional; it is not configured by this free blueprint.

`ALLOWED_ORIGIN` defaults to `https://qubitman-hub.github.io` (no `/EIGENLANDS/` path). Change it only if the browser frontend moves to a different origin. After deployment, the public server URL can optionally be saved as the repository Actions variable `VITE_SERVER_URL` to prefill the title form on the next Pages build.

## Saved progress and free-database expiry

Progress is stored in PostgreSQL, not in Render's ephemeral container filesystem. The server autosaves every 10 seconds and completes graceful saves before a normal shutdown. Its session secret is generated once by Render and retained on normal redeploys. A single process uses in-memory presence, so no Redis subscription is necessary. Do not scale to multiple server processes without configuring the existing shared-presence/cluster system.

Before the database expires:

- Use a PostgreSQL 16-or-newer client on your computer.
- In the database's networking settings, temporarily allow **your current public IP only** for external connections. The blueprint initially disables external database access.
- Use Render's external connection details with `pg_dump --format=custom` to export the database. Keep its credentials and dump private; do not post them in chat or commit them. Verify the archive with `pg_restore --list`, then remove the temporary external-access rule.
- Keep a separate copy of the service's session secret and world seed in secure storage. An archive restore needs the matching login identity to preserve existing guest tokens.

A dump can be restored with `pg_restore` into a replacement database after stopping game writes and updating `DATABASE_URL`. This blueprint does not automatically renew expired databases or provide an off-site backup service. Render's limits still apply; a permanent world requires a different arrangement. No paid upgrade is authorized by this configuration.

## Validation and performance

The repository includes a production Docker image and `deploy/render/compose.test.yml` for local deployment verification. The image installs only server/shared production dependencies, runs as a non-root user, and explicitly supports the shared TypeScript/decorator configuration. `tsx` is a runtime dependency because the existing server starts from TypeScript.

The production smoke test verifies HTTP/WebSockets, normal movement, rejection of development commands, saving a connected player through complete container recreation, stable sessions and inventories, and a real `pg_dump`/`pg_restore` round trip. It operates only on the disposable `eigenlands-render-test` project.

```sh
TSX_TSCONFIG_PATH=packages/server/tsconfig.json node --import tsx e2e/render-deployment.mjs /path/to/private-test.env
npm run loadtest -- 21 60 http://localhost:2667
```

The local test environment requires a private env file containing random `POSTGRES_PASSWORD` and `SESSION_SECRET`, plus a built `eigenlands-render:test` image. Start it with `docker compose --env-file /path/to/private-test.env -f deploy/render/compose.test.yml up -d --wait`. For a cloud build behind the managed development proxy, pass its CA with Docker's `proxy_ca` build secret; ordinary Render builds need no custom CA.

The load tool now fails if players cannot join, disconnect, receive too few acknowledgements, fail to move, exceed the tick budget or show high RTT. Its ACK-byte counter excludes state/chunk traffic and is not a full bandwidth measurement. Local CPU/memory-limited tests do not prove actual Render capacity, Asia–Australia internet latency or phone rendering performance. Test the live Render service with your group before expecting a 21-person session to be smooth.

References: [Render free limits](https://render.com/docs/free), [blueprint specification](https://render.com/docs/blueprint-spec).

### Recorded 21-player result

A 60-second local run hard-capped both the game and PostgreSQL to 0.1 CPU, with 512 MiB/256 MiB memory limits. All 21 clients joined, but the performance gate **failed**: the maximum sampled moving-average tick time was approximately 61.7 ms, with 231 over-budget ticks out of 945 observed ticks. The runtime target is 50 ms per tick. Memory peaked at approximately 140 MiB, so CPU scheduling was the clearer constraint in this run. This does not establish a smooth 20-friend capacity on Render Free. See the [recorded report](validation/render-free-21-players.json) for latency and ACK details. Real Render performance and regional internet latency still require live testing.

A follow-up five-client run had a much lower sampled average tick peak (about 4.5 ms), but still recorded 6 over-budget ticks out of 599 and failed the strict zero-overrun gate. See its [report](validation/render-free-5-players.json). Smaller testing is more plausible; neither run proves lag-free hosting.
