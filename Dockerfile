# Andreal Board OS — Hugging Face Space (Docker SDK)
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=7860 \
    HOSTNAME=0.0.0.0 \
    PGLITE_DIR=/home/node/pgdata \
    PGLITE_BACKUP=/data/board-os-db.tar.gz \
    TZ=Asia/Kolkata
# Hugging Face runs Spaces as uid 1000 (the "node" user in this image).
# The live database is on local disk (/home/node/pgdata); backups go to /data — mount a Storage Bucket there.
RUN mkdir -p /data && chown -R node:node /data /app
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/next.config.mjs ./next.config.mjs
COPY --from=build --chown=node:node /app/db ./db
COPY --from=build --chown=node:node /app/data/seed ./data/seed
USER node
EXPOSE 7860
HEALTHCHECK --interval=60s --timeout=5s --start-period=40s CMD node -e "fetch('http://127.0.0.1:7860/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node_modules/.bin/next", "start", "-p", "7860", "-H", "0.0.0.0"]
