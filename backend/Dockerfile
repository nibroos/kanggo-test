# syntax=docker/dockerfile:1

# --- dependencies ----------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
# bcrypt ships prebuilt binaries but falls back to a source build on some
# platforms, which needs a toolchain.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# --- development -----------------------------------------------------------
# Used by docker-compose.dev.yml. The source is bind-mounted over /app at run time,
# so what matters here is the toolchain and a node_modules built inside the image
# (an anonymous volume keeps the host's copy from shadowing it).
FROM node:22-bookworm-slim AS dev
ENV NODE_ENV=development

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# Runs as the image's `node` user (uid 1000), which matches a typical Linux host
# account — so files the container writes into the bind mount stay editable, and
# nothing lands in the source tree owned by root.
RUN chown node:node /app
USER node

COPY --chown=node:node package.json package-lock.json* ./
RUN npm ci

COPY --chown=node:node . .

EXPOSE 4088
ENTRYPOINT ["dumb-init", "--"]
# Polling watcher: inotify events do not cross a bind mount reliably (they are lost
# entirely on macOS and Windows hosts, and missed for editors that save by writing a
# temp file and renaming over the original). Polling a handful of directories costs
# almost nothing and works the same everywhere.
CMD ["npm", "run", "dev:poll"]

# --- runtime ---------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# dumb-init reaps zombies and forwards SIGTERM, so graceful shutdown works.
RUN apt-get update \
    && apt-get install -y --no-install-recommends dumb-init \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY scripts ./scripts
COPY migrations ./migrations
COPY docs ./docs
COPY schema.sql ./

# Run unprivileged (the node image ships a `node` user).
USER node

EXPOSE 4088
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
