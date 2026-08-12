# syntax=docker/dockerfile:1

# --- development --------------------------------------------------------------
# Used by docker-compose.dev.yml: the Vite dev server with hot module replacement.
# The source is bind-mounted over /app, so edits on the host reach the browser
# without a rebuild.
FROM node:22-bookworm-slim AS dev
WORKDIR /app

# See the backend Dockerfile: running as uid 1000 keeps bind-mounted files owned by
# the developer rather than by root.
RUN chown node:node /app
USER node

COPY --chown=node:node package.json package-lock.json* ./
RUN npm ci

COPY --chown=node:node . .

EXPOSE 5173
# --host binds to 0.0.0.0 so the port is reachable from outside the container.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# --- build ------------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Vite inlines env vars at build time, so the API URL is a build argument rather
# than a runtime one.
ARG VITE_API_BASE_URL=http://localhost:4088/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# --- serve ------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Kept outside conf.d: files there are auto-included at the http level, where these
# directives would not be valid.
COPY security-headers.inc /etc/nginx/security-headers.inc

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
