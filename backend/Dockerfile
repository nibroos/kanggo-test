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
