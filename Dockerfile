FROM node:22.13.1-bookworm-slim AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22.13.1-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY migrations ./migrations
COPY src/hub ./src/hub
COPY src/shared ./src/shared
COPY docker-entrypoint.sh /usr/local/bin/token-monitor-hub

RUN chmod +x /usr/local/bin/token-monitor-hub

EXPOSE 17321
ENTRYPOINT ["/usr/local/bin/token-monitor-hub"]
