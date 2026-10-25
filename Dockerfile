# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node packages/server/package.json packages/server/package.json
COPY --chown=node:node packages/shared/package.json packages/shared/package.json
COPY --chown=node:node packages/client/package.json packages/client/package.json
# The optional CA is only needed behind the managed development proxy, never baked into the image.
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --omit=dev --workspace=@eigenlands/server --workspace=@eigenlands/shared --include-workspace-root --strict-ssl=true && npm cache clean --force
COPY --chown=node:node tsconfig.base.json ./
COPY --chown=node:node packages/server/tsconfig.json packages/server/tsconfig.json
COPY --chown=node:node packages/shared/tsconfig.json packages/shared/tsconfig.json
COPY --chown=node:node packages/server/src packages/server/src
COPY --chown=node:node packages/shared/src packages/shared/src
ENV NODE_ENV=production
USER node
EXPOSE 10000
CMD ["./node_modules/.bin/tsx", "--tsconfig", "packages/server/tsconfig.json", "packages/server/src/main.ts"]
