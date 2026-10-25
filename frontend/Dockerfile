# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.28-alpine
# Only requests from this address/subnet may tell nginx the real client address (X-Forwarded-For).
# 127.0.0.1/32 trusts nobody; behind a TLS proxy on the same host set TRUSTED_PROXY=172.16.0.0/12 in .env.
ENV TRUSTED_PROXY=127.0.0.1/32
# The site address for absolute links in link previews (og:image); docker-compose passes APP_PUBLIC_URL.
ENV PUBLIC_URL=http://localhost:8080
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY nginx/ /etc/nginx/snippets/
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
