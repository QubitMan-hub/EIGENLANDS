# Browser multiplayer and free Cloudflare hosting

The browser can now switch between **Solo world** and **Play with friends** on the title screen. Solo saves remain in this browser. Online characters belong to the server you join. Each server has separate login credentials; joining another server never sends it your solo token.

Open **Play with friends**, enter the game server's address, then select **Join server** and **Play**. Copy the invite from that menu or Settings. Friends opening that link join the same persistent world with their own characters. The shared server intentionally has one day, weather and clock for everyone. Parties and chat are available through the existing menus. Solo characters are not automatically imported into an online world.

## What Cloudflare can host for free

Cloudflare Pages (or the existing GitHub Pages site) can serve the static browser build. This repository's existing authoritative multiplayer backend is a **Node.js / Colyseus server with PostgreSQL**, not a Worker. Pages alone cannot host that process. Porting it to Durable Objects would be a separate backend migration.

For occasional free games with friends, run the backend on your computer and use a **Cloudflare Tunnel**. There is no need to expose PostgreSQL or Redis to the internet. Your computer and tunnel must remain running. A temporary Quick Tunnel address changes when restarted; keep using the same database and session secret to retain everyone's stored characters. Browser guest logins are scoped to the server address: a new Quick Tunnel URL is treated as a different server and will not automatically resume the old guest character. Use a stable named tunnel/address for ongoing progression, or configure Google sign-in on the same database so players can recover their accounts after an address change. Free-service limits and availability remain subject to Cloudflare's current terms.

## Run the server on your computer

Install Node.js 22, Docker and Cloudflare's `cloudflared` using their official installation instructions. From the repository root:

```sh
npm ci
docker compose up -d
```

Create `.env.host` (never commit it):

```dotenv
NODE_ENV=production
PORT=2567
DATABASE_URL=postgres://eigen:eigen@localhost:5432/eigenlands
REDIS_URL=redis://localhost:6379
SESSION_SECRET=replace-with-a-long-random-secret-and-keep-it
WORLD_SEED=20260101
ALLOWED_ORIGIN=https://qubitman-hub.github.io
AUTOSAVE_MS=10000
```

Use a unique random `SESSION_SECRET`, for example one generated locally with `openssl rand -hex 32`. `ALLOWED_ORIGIN` is the browser site's origin, without `/EIGENLANDS/`. For a Cloudflare Pages frontend use its actual `https://…pages.dev` origin instead. Production mode disables development commands. The app applies its database migrations during startup.

```sh
node --env-file=.env.host node_modules/tsx/dist/cli.mjs packages/server/src/main.ts
```

In another terminal:

```sh
cloudflared tunnel --url http://localhost:2567
```

Copy the printed **https://…trycloudflare.com** address into **Play with friends → Game server address**, then share the game's **Copy friend invite** link. Keep both terminals running. Open that link on two devices; both should appear in the same world. The address is a backend address, not a replacement for the game's Pages URL.

For a stable address use a named tunnel on a domain you control, or a hosted Node server with PostgreSQL. Set the repository Actions variable `VITE_SERVER_URL` to prefill its address in future Pages builds; this is optional. The Pages build retains solo play regardless.

## Clocks and saves

New solo worlds start at dawn on day one and store a clock offset. Offline time continues normally. Existing solo worlds retain their original calendar to preserve crops, quests and respawn deadlines. Previous matching solo clocks came from the fixed world epoch; they did not imply multiplayer connectivity. Online players correctly share server time.

## Verified scope

The automated browser check exercises the production Pages bundle in online mode against the real local server, using two independent browser contexts: distinct accounts, mutual visibility, movement, synchronized minecart riding and return to the original solo save. This verifies the integration, not availability of a public Cloudflare endpoint. A public server/tunnel must still be started by its host.
