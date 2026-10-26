# Living guilds and homesteads — validation

- `guild-844.png`, `settlement-844.png`: Chromium, 844×390 landscape, actual shared window/panel builders; no horizontal overflow.
- `mounted-horse.png`: built solo browser game, actual adopted horse grown through five fed/cared dawns, trained with resources and ridden; original four-direction art and grounded rider/shadow. This is not an injected visual-only mount state.
- `resolved-investigation.png`: built solo browser game, actual accepted job, three physical evidence objects, correct accusation and restitution decision recorded with kingdom standing. Saved horse training and guild identity were checked after reload.
- `art-report.json`: all 1,248 icons, seven species (four facings, rest/feed/two strides), 33 structural pieces, 55 catalog props in both facings/all frames, original guild board/desk/evidence props. Pixel occupancy and edge checks reject blank/clipped sprites.

Reproduce with `node e2e/homestead-art.mjs http://localhost:5182/ /tmp/living-art` against a fresh source Vite server; `npm run build:pages`, preview on 5242, then `node e2e/living-guilds.mjs http://localhost:5242/ /tmp/living-gameplay`. The latter uses isolated browser storage and explicit dev commands only for resources, clock advancement and test travel; actual management, training, riding and investigation run through server handlers.

Automated rules: `packages/shared/test/living-guilds.test.ts` and `packages/server/test/living-guilds.test.ts`. Full shared/client suites and database-free server suite accompany lint, formatting, types and both build modes. The normal PostgreSQL/Redis and container/solo-browser jobs also run in PR/push CI. Physical low-end hardware and real friend-network latency remain unmeasured. Existing scripted combat tests emit schema-NaN warnings from their fixtures; these browser playtests require zero page errors.

The browser CI job allows 30 minutes: a cold dependency install consumed about eight minutes and the previous 20-minute limit cancelled the existing elevation scenario before the new gameplay test. Assertions and per-action timeouts are unchanged. The live mount check also asserts that the contextual hint says Dismount before exercising Space.

Latest-main integration retains our original horse/Glimmerhart art with the seated rider crop. It preserves the travel Stag as a separate mount state and passes the actual whistle/ranch gameplay tests together; see ../cozy-towns/ for the latest review evidence.
