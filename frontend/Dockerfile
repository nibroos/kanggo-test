# syntax=docker/dockerfile:1

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
